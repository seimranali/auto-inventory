import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { formatDate } from '../dates';
import { t } from '../i18n';
import { api, loadField } from '../api';
import { useForm } from '../hooks';
import * as C from '../constants';
import { money, pct, margin, today } from '../format';
import { PageHeader, Panel, FormGrid, Input, Select, DateField, TextArea, Field, Button, FileDropzone, Loader, useToast } from '../components';
import PartyPicker from '../components/PartyPicker';

const n = v => Number(v) || 0;

// Message under the chassis field: in stock already (error), or sold before (info: can be bought again)
function ChassisHint({ id, check }) {
  const { inStock, sold } = check;
  const name = x => [x.stock_no, x.year, x.make, x.model].filter(Boolean).join(' ');
  if (inStock) return (
    <span id={id} className="field-hint field-error">
      {t('Already in stock as')} <Link to={`/vehicles/${inStock.id}`} target="_blank">{name(inStock)}</Link> ({t(inStock.status)}).{' '}
      {t('It can be added again only after that vehicle is sold.')}
    </span>
  );
  if (sold.length) return (
    <span id={id} className="field-hint field-ok">
      {t('Bought and sold before')}: <Link to={`/vehicles/${sold[0].id}`} target="_blank">{name(sold[0])}</Link>
      {sold[0].sale_date ? ` · ${t('sold')} ${formatDate(sold[0].sale_date)}` : ''}{sold.length > 1 ? ` (+${sold.length - 1})` : ''}. {t('OK to buy again.')}
    </span>
  );
  return null;
}

export default function VehicleForm() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const form = useForm({ status: 'In Stock', condition: 'Used', purchase_date: today(), steering: 'Right' });
  const [loading, setLoading] = useState(!!id);
  const [saving, setSaving] = useState(false);
  const [pendingImages, setPendingImages] = useState([]);
  const [pendingSheet, setPendingSheet] = useState(null);
  const v = form.values;

  useEffect(() => {
    if (!id) return;
    api.vehicle(id).then(data => { form.setValues(data); setLoading(false); })
      .catch(e => { toast(e.message, 'error'); nav('/inventory'); });
  }, [id]);

  // Preview of the stock number a blank field will get (numbered by purchase month)
  const [nextStock, setNextStock] = useState('');
  useEffect(() => {
    if (id) return;
    api.nextStockNo(v.purchase_date).then(r => setNextStock(r.stock_no)).catch(() => setNextStock(''));
  }, [id, v.purchase_date?.slice(0, 7)]);

  // Live chassis check: blocked while the same chassis is in stock; allowed (with a note) if it was sold before
  const [chassis, setChassis] = useState({ inStock: null, sold: [] });
  useEffect(() => {
    const value = (v.chassis_no || '').trim();
    if (!value) return setChassis({ inStock: null, sold: [] });
    const timer = setTimeout(() => api.chassisCheck(value, id).then(setChassis).catch(() => {}), 350);
    return () => clearTimeout(timer);
  }, [v.chassis_no, id]);

  // Link the seller party and keep the text snapshot; auction houses also fill the auction fields
  const pickSeller = party => form.setValues(x => {
    if (!party) return { ...x, seller_party_id: '', supplier: '' };
    const auction = party.category === 'Auction House';
    return {
      ...x, seller_party_id: party.id, supplier: party.company_name || party.name,
      ...(auction ? { auction_house: party.name, purchase_source: 'Auction' } : {}),
      ...(!x.purchase_source && party.scope === 'International' && !auction ? { purchase_source: 'Import' } : {}),
    };
  });

  const totalCost = n(v.purchase_price) + n(v.freight_cost) + n(v.duty_tax) + n(v.repair_cost) + n(v.other_cost);
  const profit = n(v.sale_price) - totalCost - n(v.sale_expense);
  const isSold = v.status === 'Sold';

  async function submit(e) {
    e.preventDefault();
    if (!v.make || !v.model) return toast('Make and Model are required', 'error');
    if (isSold && (!v.sale_date || !v.sale_price || !v.sale_type)) return toast('Sold vehicles need Sale Type, Sale Date and Sale Price', 'error');
    if (chassis.inStock && !isSold) return toast(`Chassis ${v.chassis_no} is already in stock as ${chassis.inStock.stock_no}`, 'error');
    setSaving(true);
    try {
      const saved = id ? await api.updateVehicle(id, v) : await api.createVehicle(v);
      if (pendingImages.length) await api.uploadImages(saved.id, pendingImages);
      if (pendingSheet) await api.uploadAuctionSheet(saved.id, pendingSheet);
      toast('Vehicle saved');
      nav(`/vehicles/${saved.id}`);
    } catch (err) {
      toast(err.message, 'error');
      setSaving(false);
    }
  }

  if (loading) return <Loader />;
  const p = { form };

  return (
    <form id="vehicle-form" onSubmit={submit}>
      <PageHeader title={id ? `Edit ${v.stock_no || 'Vehicle'}` : 'Buying'}
        actions={<>
          <Button onClick={() => nav(-1)}>Cancel</Button>
          <Button variant="primary" type="submit" form="vehicle-form" disabled={saving}>{saving ? 'Saving…' : 'Save Vehicle'}</Button>
        </>} />

      <Panel title="Vehicle Information">
        <FormGrid>
          <Input {...p} name="stock_no" label="Stock No" placeholder={id ? '' : nextStock ? `Auto · ${nextStock}` : 'Auto'}
            hint={!id && !v.stock_no ? 'Leave blank to number automatically' : undefined} />
          <Field label="Chassis / VIN No">
            <input value={v.chassis_no ?? ''} onChange={e => form.set('chassis_no', e.target.value)}
              className={chassis.inStock ? 'invalid' : ''} aria-invalid={!!chassis.inStock} aria-describedby="chassis-hint" />
            <ChassisHint id="chassis-hint" check={chassis} />
          </Field>
          <Input {...p} name="engine_no" label="Engine No" />
          <Select {...p} name="make" label="Make *" options={C.MAKE_OPTIONS} loadOptions={loadField('make')} creatable sortable
            onChange={m => m !== v.make && form.set('model', '')} />
          <Select {...p} name="model" label="Model *" loadOptions={loadField('model', { make: v.make })} loadDeps={[v.make]}
            creatable sortable placeholder={v.make ? `Select ${v.make} model` : 'Select model'} />
          <Select {...p} name="variant" label="Variant / Grade" loadOptions={loadField('variant')} creatable />
          <Input {...p} name="year" label="Manufacture Year" type="number" min="1950" max="2100" />
          <Input {...p} name="reg_year" label="Registration Year" type="number" min="1950" max="2100" />
          <Input {...p} name="reg_no" label="Registration No" />
          <Select {...p} name="color" label="Color" creatable sortable loadOptions={loadField('color')}
            options={['White', 'Pearl White', 'Black', 'Silver', 'Grey', 'Blue', 'Red', 'Maroon', 'Green', 'Brown', 'Beige', 'Gold']} />
          <Input {...p} name="mileage" label="Mileage (km)" type="number" min="0" />
          <Input {...p} name="engine_cc" label="Engine (cc)" type="number" min="0" />
          <Select {...p} name="fuel" label="Fuel" options={C.FUELS} />
          <Select {...p} name="transmission" label="Transmission" options={C.TRANSMISSIONS} />
          <Select {...p} name="body_type" label="Body Type" options={C.BODY_TYPE_OPTIONS} />
          <Select {...p} name="drive" label="Drive" options={C.DRIVES} />
          <Select {...p} name="steering" label="Steering" options={C.STEERING} />
          <Input {...p} name="seats" label="Seats" type="number" min="1" />
          <Input {...p} name="doors" label="Doors" type="number" min="1" />
          <Select {...p} name="condition" label="Condition" options={C.CONDITIONS} />
          <TextArea {...p} name="features" label="Features / Options" placeholder="Sunroof, navigation, leather seats…" />
        </FormGrid>
      </Panel>

      <Panel title="Vehicle Price">
        <FormGrid>
          <DateField {...p} name="purchase_date" label="Purchase Date" max={today()} />
          <Select {...p} name="purchase_source" label="Purchase Source" options={C.PURCHASE_SOURCES} />
          <Field label="Seller (Party)" wide>
            <PartyPicker role="Seller" value={v.seller_party_id} onSelect={pickSeller} placeholder="Search sellers, auction houses, dealers…" />
          </Field>
          <Input {...p} name="purchase_price" label="Purchase Price" type="number" min="0" step="any" />
          <Input {...p} name="freight_cost" label="Freight / Shipping" type="number" min="0" step="any" />
          <Input {...p} name="duty_tax" label="Duty & Taxes" type="number" min="0" step="any" />
          <Input {...p} name="repair_cost" label="Repair / Recondition" type="number" min="0" step="any" />
          <Input {...p} name="other_cost" label="Other Costs" type="number" min="0" step="any" />
        </FormGrid>
      </Panel>

      <Panel title="Auction Sheet & Grading">
        <FormGrid>
          <Select {...p} name="auction_house" label="Auction House" loadOptions={loadField('auction_house')} creatable sortable
            options={['USS Tokyo', 'USS Nagoya', 'USS Yokohama', 'TAA Kinki', 'CAA Chubu', 'JU Tokyo', 'HAA Kobe', 'Arai Bayside', 'Copart', 'Manheim']} />
          <Input {...p} name="lot_no" label="Lot No" />
          <DateField {...p} name="auction_date" label="Auction Date" max={today()} />
          <Select {...p} name="auction_grade" label="Overall Grade" options={C.AUCTION_GRADE_OPTIONS} />
          <Select {...p} name="interior_grade" label="Interior Grade" options={C.INTERIOR_GRADES} />
          <Select {...p} name="exterior_grade" label="Exterior Grade" options={C.EXTERIOR_GRADES} />
          <TextArea {...p} name="auction_remarks" label="Auction Sheet Remarks / Damage Notes" placeholder="A1 scratch rear bumper, U2 dent left door…" />
        </FormGrid>
        {!id && (
          <div style={{ marginTop: 12 }}>
            <FileDropzone multiple={false} accept="image/*,application/pdf" onFiles={setPendingSheet}
              label={pendingSheet ? `Auction sheet: ${pendingSheet.name} (click to change)` : 'Attach auction sheet (image or PDF)'} />
          </div>
        )}
      </Panel>

      <Panel title="Status & Ask Price">
        <FormGrid>
          <Select {...p} name="status" label="Status" options={C.STATUSES} placeholder={false} />
          <Select {...p} name="location" label="Location / Yard" loadOptions={loadField('location')} creatable />
          <Input {...p} name="asking_price" label="Asking Price" type="number" min="0" step="any" />
        </FormGrid>
        {isSold && (
          <div style={{ marginTop: 12 }}>
            <FormGrid>
              <Select {...p} name="sale_type" label="Sale Type *" options={C.SALE_TYPES} />
              <DateField {...p} name="sale_date" label="Sale Date *" min={v.purchase_date || undefined} max={today()}
                hint={v.purchase_date ? 'Cannot be before the purchase date' : undefined} />
              <Input {...p} name="sale_price" label="Sale Price *" type="number" min="0" step="any" />
              <Select {...p} name="buyer_name" label="Buyer Name" loadOptions={loadField('buyer_name')} creatable />
              <Input {...p} name="buyer_contact" label="Buyer Contact" />
              {v.sale_type === 'Export' && <>
                <Select {...p} name="destination_country" label="Destination Country" loadOptions={loadField('destination_country')} creatable sortable
                  options={['UAE', 'Kenya', 'Tanzania', 'Uganda', 'Afghanistan', 'Russia', 'Mongolia', 'Sri Lanka', 'Bangladesh', 'New Zealand', 'Chile', 'Jamaica']} />
                <Select {...p} name="port" label="Destination Port" loadOptions={loadField('port')} creatable sortable />
              </>}
            </FormGrid>
          </div>
        )}
        <div className="calc">
          <div><span className="muted">Total Cost</span><b>{money(totalCost)}</b></div>
          {isSold && <>
            <div><span className="muted">Sale Price</span><b>{money(n(v.sale_price))}</b></div>
            <div><span className="muted">Profit</span><b className={profit >= 0 ? 'pos' : 'neg'}>{money(profit)}</b></div>
            <div><span className="muted">Margin</span><b>{pct(margin(profit, n(v.sale_price)))}</b></div>
          </>}
          {!isSold && v.asking_price && <div><span className="muted">Expected Profit</span><b>{money(n(v.asking_price) - totalCost)}</b></div>}
        </div>
      </Panel>

      {!id && (
        <Panel title="Vehicle Images">
          <FileDropzone onFiles={files => setPendingImages(x => [...x, ...files])} />
          {pendingImages.length > 0 && (
            <div className="gallery">
              {pendingImages.map((f, i) => (
                <figure key={i}>
                  <img src={URL.createObjectURL(f)} alt="" />
                  <div className="tools"><Button variant="danger" onClick={() => setPendingImages(x => x.filter((_, j) => j !== i))}>Remove</Button></div>
                </figure>
              ))}
            </div>
          )}
        </Panel>
      )}

      <Panel title="Notes">
        <FormGrid><TextArea {...p} name="notes" label="Internal Notes" /></FormGrid>
      </Panel>
    </form>
  );
}
