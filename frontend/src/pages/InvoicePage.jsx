import { useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { api, fileUrl } from '../api';
import { useAsync } from '../hooks';
import { useAuth } from '../auth';
import { money, vehicleTitle, getCurrency, formatAddress, JP_ACCOUNT_LABEL } from '../format';
import { formatDate } from '../dates';
import { Button, Loader, ErrorBox } from '../components';

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve',
  'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function below1000(n) {
  const h = Math.floor(n / 100), r = n % 100;
  const rest = r < 20 ? ONES[r] : `${TENS[Math.floor(r / 10)]}${r % 10 ? ' ' + ONES[r % 10] : ''}`;
  return [h ? `${ONES[h]} Hundred` : '', rest].filter(Boolean).join(' ');
}

// International system: 1,250,000 -> "One Million Two Hundred Fifty Thousand"
export function amountInWords(amount) {
  let n = Math.round(Number(amount) || 0);
  if (!n) return 'Zero';
  const parts = [];
  for (const [size, name] of [[1e9, 'Billion'], [1e6, 'Million'], [1e3, 'Thousand'], [1, '']]) {
    const chunk = Math.floor(n / size);
    if (chunk) { parts.push(`${below1000(chunk)}${name ? ' ' + name : ''}`); n %= size; }
  }
  return parts.join(' ');
}

// A4 portrait with 10 mm margins leaves 190 x 277 mm for the invoice
const MM = 96 / 25.4;
const PAGE_W = 190 * MM, PAGE_H = 277 * MM;

/**
 * Printing always fits the invoice on one A4 page: just before printing, the compact print layout is
 * applied at A4 width and measured; if it is still taller than the page, it is scaled down to fit.
 */
function useFitToA4() {
  const ref = useRef();
  useEffect(() => {
    const before = () => {
      const el = ref.current;
      if (!el) return;
      el.classList.add('inv-compact', 'inv-measure');
      el.style.setProperty('--inv-fit', 1);
      const h = el.scrollHeight;
      el.classList.remove('inv-measure');
      el.style.setProperty('--inv-fit', Math.min(1, (PAGE_H - 4) / h).toFixed(3));
    };
    const after = () => { ref.current?.classList.remove('inv-compact'); ref.current?.style.removeProperty('--inv-fit'); };
    window.addEventListener('beforeprint', before);
    window.addEventListener('afterprint', after);
    return () => { window.removeEventListener('beforeprint', before); window.removeEventListener('afterprint', after); };
  }, []);
  return ref;
}

export default function InvoicePage() {
  const { id } = useParams();
  const { company, can } = useAuth();
  const { data: v, error, loading } = useAsync(() => api.vehicle(id), [id]);
  const sheet = useFitToA4();
  const COMPANY = { ...company, terms: (company?.terms || '').split('\n').filter(Boolean) };
  const CURRENCY = getCurrency();
  const jpCo = company?.country === 'Japan';
  if (loading || !company) return <Loader />;
  if (error) return <ErrorBox error={error} />;
  if (v.status !== 'Sold') return <ErrorBox error="This vehicle has not been sold yet." />;

  const balance = (v.sale_price || 0) - (v.amount_received || 0);
  const cover = v.images?.[0];
  const exp = v.sale_type === 'Export';
  const specs = [
    ['Make', v.make], ['Model', v.model], ['Variant', v.variant], ['Year', v.year],
    ['Chassis / VIN No', v.chassis_no], ['Engine No', v.engine_no], ['Engine', v.engine_cc && `${v.engine_cc} cc`],
    ['Color', v.color], ['Mileage', v.mileage != null && `${v.mileage.toLocaleString()} km`], ['Fuel', v.fuel],
    ['Transmission', v.transmission], ['Body Type', v.body_type], ['Registration No', v.reg_no], ['Auction Grade', v.auction_grade],
  ].filter(([, x]) => x);

  return (
    <>
      <div className="row spread no-print" style={{ marginBottom: 16 }}>
        <Button to={`/vehicles/${id}`}>← Back to vehicle</Button>
        <div className="row">
          {can('sales:write') && <Button to={`/vehicles/${id}/sell`}>Edit Sale</Button>}
          <Button variant="primary" onClick={() => window.print()}>Print Invoice</Button>
        </div>
      </div>

      <article className="invoice" ref={sheet}>
        <header className="inv-head">
          <div>
            {COMPANY.logo && <img className="inv-logo" src={fileUrl(COMPANY.logo)} alt="" />}
            {/* Export invoices lead with the English name; domestic ones with the Japanese name */}
            <div className="inv-company">{jpCo && exp && COMPANY.name_en ? COMPANY.name_en : COMPANY.name}</div>
            {jpCo && COMPANY.name_en && <div className="inv-small"><b>{exp ? COMPANY.name : COMPANY.name_en}</b></div>}
            <div className="muted">{COMPANY.tagline}</div>
            <div className="inv-small">{formatAddress(COMPANY)}{COMPANY.country ? `, ${COMPANY.country}` : ''}</div>
            <div className="inv-small">{[COMPANY.phone && `TEL ${COMPANY.phone}`, COMPANY.fax && `FAX ${COMPANY.fax}`, COMPANY.email, COMPANY.website].filter(Boolean).join(' · ')}</div>
            {jpCo ? <>
              {COMPANY.invoice_reg_no && <div className="inv-small">登録番号 Registration No. <b>{COMPANY.invoice_reg_no}</b></div>}
              {COMPANY.antique_license && <div className="inv-small">古物商許可 {COMPANY.antique_license}{COMPANY.antique_license_authority ? ` (${COMPANY.antique_license_authority})` : ''}</div>}
            </> : COMPANY.ntn && <div className="inv-small">NTN: {COMPANY.ntn}</div>}
          </div>
          <div className="inv-title">
            <h1>{exp ? 'EXPORT SALE INVOICE' : 'SALE INVOICE'}</h1>
            <table className="inv-meta">
              <tbody>
                <tr><th>Invoice No</th><td>{v.invoice_no}</td></tr>
                <tr><th>Date</th><td>{formatDate(v.sale_date)}</td></tr>
                <tr><th>Stock No</th><td>{v.stock_no}</td></tr>
                <tr><th>Sale Type</th><td>{v.sale_type}</td></tr>
              </tbody>
            </table>
          </div>
        </header>

        <section className="inv-parties">
          <div>
            <div className="inv-label">Bill To</div>
            <strong>{v.buyer_name}</strong>
            {v.buyer_id_no && <div>{exp ? 'Passport / Reg' : 'CNIC'}: {v.buyer_id_no}</div>}
            {v.buyer_address && <div style={{ whiteSpace: 'pre-line' }}>{v.buyer_address}</div>}
            {v.buyer_contact && <div>{v.buyer_contact}</div>}
          </div>
          {exp && (
            <div>
              <div className="inv-label">Shipment</div>
              <div>Destination: <strong>{[v.port, v.destination_country].filter(Boolean).join(', ') || '-'}</strong></div>
              {v.shipping_ref && <div>Shipping Ref / B/L: {v.shipping_ref}</div>}
            </div>
          )}
        </section>

        <div className="inv-label">Vehicle Particulars</div>
        <div className={`inv-vehicle ${cover ? 'has-photo' : ''}`}>
          <table className="inv-specs">
            <tbody>
              {Array.from({ length: Math.ceil(specs.length / 2) }, (_, i) => (
                <tr key={i}>
                  {[specs[i * 2], specs[i * 2 + 1]].flatMap((s, j) => [
                    <th key={`k${j}`}>{s?.[0]}</th>, <td key={`v${j}`}>{s?.[1]}</td>,
                  ])}
                </tr>
              ))}
            </tbody>
          </table>
          {cover && <img className="inv-photo" src={fileUrl(cover.file_name)} alt={vehicleTitle(v)} />}
        </div>

        <table className="inv-lines">
          <thead><tr><th>#</th><th>Description</th><th className="num">Amount ({CURRENCY})</th></tr></thead>
          <tbody>
            <tr>
              <td>1</td>
              <td><strong>{vehicleTitle(v)}</strong><div className="inv-small">{[`Chassis ${v.chassis_no || '-'}`, v.color].filter(Boolean).join(' · ')}</div></td>
              <td className="num">{money(v.sale_price)}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr><td colSpan={2} className="num">Total</td><td className="num">{money(v.sale_price)}</td></tr>
            <tr><td colSpan={2} className="num">Received ({v.payment_method || '-'})</td><td className="num">{money(v.amount_received || 0)}</td></tr>
            <tr className="inv-balance"><td colSpan={2} className="num">Balance Due</td><td className="num">{money(balance)}</td></tr>
          </tfoot>
        </table>
        <div className="inv-words"><strong>Amount in words:</strong> {CURRENCY} {amountInWords(v.sale_price)} Only</div>

        {v.sale_notes && <div className="inv-notes"><strong>Remarks:</strong> {v.sale_notes}</div>}

        {COMPANY.bank_name && (
          <div className="inv-bank">
            <div className="inv-label">{jpCo ? 'Bank Details 振込先' : 'Bank Details'}</div>
            <div>{[COMPANY.bank_name, COMPANY.bank_branch && `${COMPANY.bank_branch}${COMPANY.bank_branch_code ? ` (${COMPANY.bank_branch_code})` : ''}`].filter(Boolean).join(' · ')}</div>
            <div>{jpCo && COMPANY.account_type ? `${JP_ACCOUNT_LABEL[COMPANY.account_type]} ` : 'A/C '}{COMPANY.account_no}{COMPANY.account_title ? ` · ${COMPANY.account_title}` : ''}</div>
            {exp && COMPANY.swift && <div>SWIFT / BIC: <b>{COMPANY.swift}</b></div>}
          </div>
        )}

        <div className="inv-terms">
          <div className="inv-label">Terms &amp; Conditions</div>
          <ol>{COMPANY.terms.map((t, i) => <li key={i}>{t}</li>)}</ol>
        </div>

        <footer className="inv-sign">
          <div><span />Buyer's Signature</div>
          <div><span />Authorized Signature &amp; Stamp</div>
        </footer>
        <div className="inv-foot">Thank you for your business.</div>
      </article>
    </>
  );
}
