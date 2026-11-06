import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, fileUrl } from '../api';
import { useAuth } from '../auth';
import { useAsync } from '../hooks';
import { GRADE_HELP } from '../constants';
import { money, pct, margin, vehicleTitle, daysInStock, getCurrency, formatAddress } from '../format';
import { amountInWords } from './InvoicePage';
import { formatDate } from '../dates';
import {
  PageHeader, Panel, InfoList, Button, StatusBadge, GradeBadge, SaleTypeBadge, Tabs,
  FileDropzone, DocumentPreview, Loader, ErrorBox, useToast, useLightbox,
} from '../components';
import NavIcon from '../components/NavIcon';

const TL_ICON = { auction: 'available', in: 'buy', out: 'sell' };
const signed = n => <span className={n > 0 ? 'pos' : n < 0 ? 'neg' : ''}>{money(n)}</span>;

/* Photo grid: the cover large, the next photos beside it; "+N" opens the rest. Every tile opens the full-screen viewer.
   Editors get set-cover / delete tools on each tile and an upload strip below. */
const GRID_MAX = 5;
function PhotoViewer({ images, title, canEdit, busy, onUpload, onCover, onDelete }) {
  const open = useLightbox();
  const urls = images.map(i => fileUrl(i.file_name));

  if (!images.length) {
    return (
      <div className="vd-photo vd-photo-empty">
        <NavIcon name="inventory" size={64} strokeWidth={1.2} />
        <p>No photos yet</p>
        {canEdit && <FileDropzone busy={busy} onFiles={onUpload} label="Drop photos here or click to upload" />}
      </div>
    );
  }
  const shown = images.slice(0, GRID_MAX);
  const more = images.length - shown.length;
  return (
    <div className="vd-gallery">
      <div className={`vd-grid n${shown.length}`}>
        {shown.map((img, i) => (
          <figure key={img.id}>
            <img src={urls[i]} alt={i === 0 ? title : `${title} — photo ${i + 1}`} loading="lazy" onClick={() => open(urls, i)} />
            {i === 0 && <span className="cover-tag">Cover</span>}
            {more > 0 && i === shown.length - 1 && (
              <button type="button" className="vd-more" onClick={() => open(urls, i)}>+{more} more</button>
            )}
            {canEdit && (
              <div className="vd-thumb-tools">
                {i > 0 && <button type="button" title="Set as cover" aria-label="Set as cover" onClick={() => onCover(img)}>★</button>}
                <button type="button" title="Delete photo" aria-label="Delete photo" className="del" onClick={() => onDelete(img)}>×</button>
              </div>
            )}
          </figure>
        ))}
      </div>
      <div className="vd-gallery-foot">
        <button type="button" className="link-btn" onClick={() => open(urls, 0)}>View all {images.length} photo{images.length === 1 ? '' : 's'}</button>
        {canEdit && <FileDropzone busy={busy} onFiles={onUpload} label="+ Add photos" />}
      </div>
    </div>
  );
}

function PartyCard({ title, party, fallback, empty }) {
  if (!party && !fallback) return <div className="vd-party empty"><span className="muted">{title}</span><span>{empty}</span></div>;
  const intl = party?.scope === 'International';
  return (
    <div className="vd-party">
      <span className="muted">{title}</span>
      {party ? (
        <Link to={`/parties/${party.id}`} className="vd-party-name">
          <span className={`avatar ${intl ? 'avatar-intl' : ''}`}>{party.name.slice(0, 1).toUpperCase()}</span>
          <span><b>{party.name}</b><small>{[party.code, party.category, intl ? party.country : party.city].filter(Boolean).join(' · ')}</small></span>
        </Link>
      ) : <b>{fallback}</b>}
      {party?.phone && <a className="vd-party-phone" href={`tel:${party.phone.replace(/\s/g, '')}`}>{party.phone}</a>}
    </div>
  );
}

/* Print-only purchase document: replaces the screen layout when printing */
function PurchaseRecord({ v, company, costs }) {
  const seller = v.seller;
  const specs = [
    ['Make', v.make], ['Model', v.model], ['Variant', v.variant], ['Year', v.year],
    ['Chassis / VIN No', v.chassis_no], ['Engine No', v.engine_no], ['Engine', v.engine_cc && `${v.engine_cc} cc`],
    ['Color', v.color], ['Mileage', v.mileage != null && `${v.mileage.toLocaleString()} km`], ['Fuel', v.fuel],
    ['Transmission', v.transmission], ['Body Type', v.body_type], ['Drive', v.drive], ['Steering', v.steering],
    ['Registration No', v.reg_no], ['Condition', v.condition],
  ].filter(([, x]) => x);
  const auction = [['Auction House', v.auction_house], ['Lot No', v.lot_no], ['Auction Date', v.auction_date && formatDate(v.auction_date)],
    ['Overall Grade', v.auction_grade], ['Interior / Exterior', (v.interior_grade || v.exterior_grade) && `${v.interior_grade || '–'} / ${v.exterior_grade || '–'}`]]
    .filter(([, x]) => x);
  const pairs = list => Array.from({ length: Math.ceil(list.length / 2) }, (_, i) => (
    <tr key={i}>{[list[i * 2], list[i * 2 + 1]].flatMap((s, j) => [<th key={`k${j}`}>{s?.[0]}</th>, <td key={`v${j}`}>{s?.[1]}</td>])}</tr>
  ));
  const cover = v.images?.[0];

  return (
    <article className="invoice purchase-doc print-only">
      <header className="inv-head">
        <div>
          {company?.logo && <img className="inv-logo" src={fileUrl(company.logo)} alt="" />}
          <div className="inv-company">{company?.name}</div>
          {company?.name_en && company.name_en !== company.name && <div className="inv-small"><b>{company.name_en}</b></div>}
          <div className="inv-small">{formatAddress(company || {})}{company?.country ? `, ${company.country}` : ''}</div>
          <div className="inv-small">{[company?.phone && `TEL ${company.phone}`, company?.email, company?.website].filter(Boolean).join(' · ')}</div>
          {company?.antique_license && <div className="inv-small">古物商許可 {company.antique_license}</div>}
        </div>
        <div className="inv-title">
          <h1>VEHICLE PURCHASE RECORD</h1>
          <table className="inv-meta">
            <tbody>
              <tr><th>Stock No</th><td>{v.stock_no || '-'}</td></tr>
              <tr><th>Purchase Date</th><td>{v.purchase_date ? formatDate(v.purchase_date) : '-'}</td></tr>
              <tr><th>Source</th><td>{v.purchase_source || '-'}</td></tr>
              <tr><th>Status</th><td>{v.status}</td></tr>
            </tbody>
          </table>
        </div>
      </header>

      <section className="inv-parties">
        <div>
          <div className="inv-label">Purchased From (Seller)</div>
          <strong>{seller?.name || v.supplier || '-'}</strong>
          {seller?.code && <div className="inv-small">{[seller.code, seller.category].filter(Boolean).join(' · ')}</div>}
          {seller && formatAddress(seller) && <div>{formatAddress(seller)}</div>}
          {seller?.phone && <div>TEL {seller.phone}</div>}
          {v.supplier && v.supplier !== seller?.name && <div className="inv-small">Agent / Supplier: {v.supplier}</div>}
        </div>
        {cover && <img className="pr-photo" src={fileUrl(cover.file_name)} alt="" />}
      </section>

      <div className="inv-label">Vehicle Particulars</div>
      <table className="inv-specs"><tbody>{pairs(specs)}</tbody></table>

      {auction.length > 0 && <>
        <div className="inv-label">Auction Details</div>
        <table className="inv-specs"><tbody>{pairs(auction)}</tbody></table>
      </>}

      <table className="inv-lines">
        <thead><tr><th>#</th><th>Cost Item</th><th className="num">Amount ({getCurrency()})</th></tr></thead>
        <tbody>
          {costs.map(([k, n], i) => <tr key={k}><td>{i + 1}</td><td>{k}</td><td className="num">{money(n || 0)}</td></tr>)}
        </tbody>
        <tfoot>
          <tr className="inv-balance"><td colSpan={2} className="num">Total Landed Cost</td><td className="num">{money(v.total_cost)}</td></tr>
          {v.asking_price ? <tr><td colSpan={2} className="num">Asking Price</td><td className="num">{money(v.asking_price)}</td></tr> : null}
        </tfoot>
      </table>
      <div className="inv-words"><strong>Purchase price in words:</strong> {getCurrency()} {amountInWords(v.purchase_price)} Only</div>

      {v.auction_remarks && <div className="inv-notes"><strong>Damage / Remarks:</strong> {v.auction_remarks}</div>}
      {v.notes && <div className="inv-notes"><strong>Notes:</strong> {v.notes}</div>}

      <footer className="inv-sign">
        <div><span />Seller's Signature</div>
        <div><span />Received By</div>
        <div><span />Authorized Signature &amp; Stamp</div>
      </footer>
      <div className="inv-foot">Printed {new Date().toLocaleString()}</div>
    </article>
  );
}

export default function VehicleDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const { data: v, error, loading, setData } = useAsync(() => api.vehicle(id), [id]);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState('overview');
  const { can, company } = useAuth();
  const canEdit = can('vehicles:write'), canSell = can('sales:write');

  if (loading) return <Loader />;
  if (error) return <ErrorBox error={error} />;

  const act = async (fn, msg) => {
    setBusy(true);
    try { setData(await fn()); if (msg) toast(msg); } catch (e) { toast(e.message, 'error'); }
    setBusy(false);
  };
  const remove = async () => {
    if (!confirm(`Delete ${v.stock_no || 'this vehicle'} permanently, including its images?`)) return;
    await api.deleteVehicle(id);
    toast('Vehicle deleted');
    nav('/inventory');
  };

  const sold = v.status === 'Sold';
  const days = daysInStock(v);
  const costs = [['Purchase price', v.purchase_price], ['Freight / shipping', v.freight_cost], ['Duty & taxes', v.duty_tax],
    ['Repair / recondition', v.repair_cost], ['Other costs', v.other_cost]];
  const expected = v.asking_price ? v.asking_price - (v.total_cost || 0) : null;
  const received = v.amount_received || 0;
  const balance = (v.sale_price || 0) - received;

  const specs = [
    ['Year', v.year], ['Mileage', v.mileage != null ? `${v.mileage.toLocaleString()} km` : null], ['Engine', v.engine_cc ? `${v.engine_cc} cc` : null],
    ['Fuel', v.fuel], ['Transmission', v.transmission], ['Body', v.body_type], ['Drive', v.drive], ['Color', v.color],
  ].filter(([, x]) => x);

  // Real events only; the record's creation date is used just when no purchase date was entered
  const timeline = [
    v.auction_date && v.auction_date !== v.purchase_date && { date: v.auction_date, kind: 'auction', label: 'Won at auction', detail: [v.auction_house, v.lot_no && `Lot ${v.lot_no}`].filter(Boolean).join(' · ') },
    v.purchase_date
      ? { date: v.purchase_date, kind: 'in', label: v.auction_date === v.purchase_date ? 'Bought at auction (IN)' : 'Purchased (IN)',
        detail: [v.seller?.name || v.supplier, v.auction_date === v.purchase_date && v.lot_no && `Lot ${v.lot_no}`].filter(Boolean).join(' · ') }
      : { date: v.created_at?.slice(0, 10), kind: 'in', label: 'Added to inventory', detail: v.location },
    sold && v.sale_date && { date: v.sale_date, kind: 'out', label: `Sold (OUT) · ${v.sale_type || ''}`, detail: [v.buyer?.name || v.buyer_name, v.invoice_no].filter(Boolean).join(' · ') },
  ].filter(Boolean).sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  const gap = (a, b) => (a && b ? Math.round((new Date(b) - new Date(a)) / 864e5) : null);

  return (
    <>
      <PageHeader
        title={<>{vehicleTitle(v)} <StatusBadge status={v.status} /></>}
        subtitle={<span className="vd-sub">
          <span>Stock # <b>{v.stock_no || '-'}</b></span>
          <span>Chassis <b>{v.chassis_no || '-'}</b></span>
          {v.reg_no && <span>Reg <b>{v.reg_no}</b></span>}
          {v.location && <span>{v.location}</span>}
        </span>}
        actions={<>
          <Button to="/inventory" title="Back to Inventory">← Inventory</Button>
          {canEdit && <Button to="/vehicles/new">+ New Buying</Button>}
          <Button onClick={() => window.print()}>Print</Button>
          {sold && <Button to={`/vehicles/${id}/invoice`}>Invoice</Button>}
          {canSell && <Button variant={sold ? 'default' : 'primary'} to={`/vehicles/${id}/sell`}>{sold ? 'Edit Sale' : 'Sell Vehicle'}</Button>}
          {canEdit && <Button variant={sold ? 'primary' : 'default'} to={`/vehicles/${id}/edit`}>Edit</Button>}
          {canEdit && <Button variant="danger" onClick={remove} aria-label="Delete vehicle">Delete</Button>}
        </>} />

      <PurchaseRecord v={v} company={company} costs={costs} />

      <div className="vd-layout">
        {/* ---------- Main column ---------- */}
        <div className="vd-main">
          <PhotoViewer images={v.images} title={vehicleTitle(v)} canEdit={canEdit} busy={busy}
            onUpload={files => act(() => api.uploadImages(id, files), 'Photos uploaded')}
            onCover={img => act(() => api.setCover(id, img.id), 'Cover updated')}
            onDelete={img => confirm('Delete this photo?') && act(() => api.deleteImage(id, img.id), 'Photo deleted')} />

          <div className="vd-specs">
            {specs.map(([k, val]) => <div key={k}><small>{k}</small><b>{val}</b></div>)}
            <div><small>Grade</small><b><GradeBadge grade={v.auction_grade} interior={v.interior_grade} /></b></div>
          </div>

          <div className="panel">
            <Tabs value={tab} onChange={setTab} tabs={[
              { id: 'overview', label: 'Overview' },
              { id: 'purchase', label: 'Purchase & Costs' },
              { id: 'auction', label: `Auction Sheet${v.auction_sheet ? ' ✓' : ''}` },
              ...(sold ? [{ id: 'sale', label: 'Sale' }] : []),
            ]} />

            <section className={`vd-tab ${tab === 'overview' ? '' : 'print-only'}`}><h2 className="print-only vd-tab-title">Overview</h2>
              <h3 className="vd-h">Identification</h3>
              <InfoList items={[['Make', v.make], ['Model', v.model], ['Variant', v.variant], ['Condition', v.condition],
                ['Chassis / VIN', v.chassis_no], ['Engine No', v.engine_no], ['Reg. No', v.reg_no], ['Reg. Year', v.reg_year]]} />
              <h3 className="vd-h">Specifications</h3>
              <InfoList items={[['Year', v.year], ['Mileage', v.mileage != null ? `${v.mileage.toLocaleString()} km` : null],
                ['Engine', v.engine_cc ? `${v.engine_cc} cc` : null], ['Fuel', v.fuel], ['Transmission', v.transmission],
                ['Body', v.body_type], ['Drive', v.drive], ['Steering', v.steering], ['Seats', v.seats], ['Doors', v.doors], ['Color', v.color]]} />
              {v.features && <>
                <h3 className="vd-h">Features</h3>
                <div className="vd-tags">{v.features.split(/,\s*/).filter(Boolean).map(f => <span key={f}>{f}</span>)}</div>
              </>}
              {v.notes && <><h3 className="vd-h">Internal Notes</h3><p className="vd-notes">{v.notes}</p></>}
            </section>

            <section className={`vd-tab ${tab === 'purchase' ? '' : 'print-only'}`}><h2 className="print-only vd-tab-title">Purchase & Costs</h2>
              <InfoList items={[['Purchase Date', v.purchase_date ? formatDate(v.purchase_date) : null], ['Source', v.purchase_source],
                ['Seller', v.seller ? <Link key="s" to={`/parties/${v.seller.id}`}>{v.seller.name}</Link> : v.supplier],
                ['Agent / Supplier', v.supplier && v.supplier !== v.seller?.name ? v.supplier : null]]} />
              <table className="vd-cost-table">
                <tbody>
                  {costs.map(([k, n]) => <tr key={k}><td>{k}</td><td className="num">{money(n || 0)}</td></tr>)}
                </tbody>
                <tfoot><tr><td>Total landed cost</td><td className="num">{money(v.total_cost)}</td></tr></tfoot>
              </table>
            </section>

            <section className={`vd-tab ${tab === 'auction' ? '' : 'print-only'}`}><h2 className="print-only vd-tab-title">Auction Sheet</h2>
              <div className="vd-grade-hero">
                <div className="vd-grade-big">{v.auction_grade || '–'}</div>
                <div>
                  <b>{GRADE_HELP[v.auction_grade] || 'No grade recorded'}</b>
                  <div className="muted">Interior {v.interior_grade || '–'} · Exterior {v.exterior_grade || '–'}</div>
                </div>
              </div>
              <InfoList items={[['Auction House', v.auction_house], ['Lot No', v.lot_no], ['Auction Date', v.auction_date ? formatDate(v.auction_date) : null]]} />
              {v.auction_remarks && <><h3 className="vd-h">Remarks / Damage Notes</h3><p className="vd-notes">{v.auction_remarks}</p></>}
              <div className="sheet">
                <DocumentPreview name={v.auction_sheet} />
                {!v.auction_sheet && <p className="muted">No auction sheet uploaded.</p>}
                {canEdit && (
                  <div className="row no-print" style={{ marginTop: 10 }}>
                    <div style={{ flex: 1 }}>
                      <FileDropzone multiple={false} accept="image/*,application/pdf" busy={busy}
                        label={v.auction_sheet ? 'Replace auction sheet (image or PDF)' : 'Upload auction sheet (image or PDF)'}
                        onFiles={file => act(() => api.uploadAuctionSheet(id, file), 'Auction sheet uploaded')} />
                    </div>
                    {v.auction_sheet && <Button variant="danger" onClick={() => confirm('Remove auction sheet?') && act(() => api.deleteAuctionSheet(id), 'Auction sheet removed')}>Remove</Button>}
                  </div>
                )}
              </div>
            </section>

            {sold && (
              <section className={`vd-tab ${tab === 'sale' ? '' : 'print-only'}`}><h2 className="print-only vd-tab-title">Sale</h2>
              <InfoList items={[
                ['Invoice No', v.invoice_no ? <Link key="i" to={`/vehicles/${id}/invoice`}>{v.invoice_no}</Link> : null],
                ['Sale Type', <SaleTypeBadge key="t" type={v.sale_type} />], ['Sale Date', formatDate(v.sale_date)],
                ['Buyer', v.buyer ? <Link key="b" to={`/parties/${v.buyer.id}`}>{v.buyer.name}</Link> : v.buyer_name],
                ['Name on Invoice', v.buyer_name], ['Buyer Contact', v.buyer_contact], ['Buyer ID', v.buyer_id_no],
                ['Destination', [v.port, v.destination_country].filter(Boolean).join(', ') || null], ['Shipping Ref', v.shipping_ref],
                ['Payment Method', v.payment_method],
              ]} />
              </section>
            )}
          </div>
        </div>

        {/* ---------- Side column ---------- */}
        <aside className="vd-side">
          <div className="panel vd-money">
            <span className="muted">{sold ? 'Sold for' : 'Asking price'}</span>
            <div className="vd-price">{money(sold ? v.sale_price : v.asking_price)}</div>
            <div className="vd-profit-row">
              {sold
                ? <><span>Profit {signed(v.profit)}</span><span className="vd-margin">{pct(margin(v.profit, v.sale_price))} margin</span></>
                : expected != null && <><span>Expected {signed(expected)}</span><span className="vd-margin">{pct(margin(expected, v.asking_price))} margin</span></>}
            </div>
            <dl className="vd-breakdown">
              <div><dt>Total cost</dt><dd>{money(v.total_cost)}</dd></div>
              <div><dt>{sold ? 'Days to sell' : 'Days in stock'}</dt>
                <dd><span className={`age ${days > 60 ? 'age-old' : days > 30 ? 'age-mid' : ''}`}>{days ?? '-'}{days != null ? 'd' : ''}</span></dd></div>
            </dl>
            {sold && (
              <div className="vd-payment">
                <div className="row spread"><span>Payment</span><b className={balance > 0 ? 'neg' : 'pos'}>{balance > 0 ? `${money(balance)} due` : 'Paid in full'}</b></div>
                <div className="progress wide"><span style={{ width: `${v.sale_price ? Math.min(100, (received / v.sale_price) * 100) : 0}%` }} /></div>
                <small className="muted">{money(received)} received{v.payment_method ? ` · ${v.payment_method}` : ''}</small>
              </div>
            )}
          </div>

          <div className="panel">
            <h2 className="vd-side-h">Parties</h2>
            <PartyCard title="Seller" party={v.seller} fallback={v.supplier || v.auction_house} empty="Not recorded" />
            <PartyCard title="Buyer" party={v.buyer} fallback={v.buyer_name} empty={sold ? 'Not recorded' : 'Not sold yet'} />
          </div>

          <div className="panel">
            <h2 className="vd-side-h">Timeline</h2>
            <ol className="vd-timeline">
              {timeline.map((t, i) => {
                const d = i > 0 ? gap(timeline[i - 1].date, t.date) : null;
                return (
                  <li key={i} className={`tl-${t.kind}`}>
                    {d > 0 && <span className="tl-gap">{d} day{d === 1 ? '' : 's'}</span>}
                    <span className="tl-dot"><NavIcon name={TL_ICON[t.kind]} size={13} strokeWidth={2.4} /></span>
                    <div className="tl-body">
                      <div className="tl-row"><b>{t.label}</b><time>{t.date ? formatDate(t.date) : ''}</time></div>
                      {t.detail && <small>{t.detail}</small>}
                    </div>
                  </li>
                );
              })}
              {!sold && (
                <li className="tl-pending">
                  {days > 0 && <span className="tl-gap">{days} day{days === 1 ? '' : 's'} so far</span>}
                  <span className="tl-dot"><NavIcon name="clock" size={13} strokeWidth={2.4} /></span>
                  <div className="tl-body"><div className="tl-row"><b>Awaiting sale</b></div><small>{v.asking_price ? `Asking ${money(v.asking_price)}` : 'No asking price set'}</small></div>
                </li>
              )}
            </ol>
          </div>
        </aside>
      </div>
    </>
  );
}
