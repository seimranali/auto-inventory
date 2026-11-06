import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, loadField } from '../api';
import { useForm } from '../hooks';
import PartyPicker from '../components/PartyPicker';
import { SALE_TYPES, PAYMENT_METHODS } from '../constants';
import { money, pct, margin, today, vehicleTitle } from '../format';
import {
  PageHeader, Panel, FormGrid, Input, Select, DateField, TextArea, Field, Dropdown, Button, InfoList,
  StatCard, StatGrid, GradeBadge, Thumb, Loader, useToast,
} from '../components';

const n = v => Number(v) || 0;

// Available vehicles for the picker, grouped by make
const loadAvailable = q => api.vehicles({ q }).then(rows => rows.filter(v => v.status !== 'Sold').map(v => ({
  value: v.id, label: `${v.stock_no || '—'} · ${vehicleTitle(v)}`, group: v.make || 'Other',
  description: [v.chassis_no, v.color].filter(Boolean).join(' · '),
})));

export default function SalePage() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const [vehicleId, setVehicleId] = useState(id || '');
  const [vehicle, setVehicle] = useState(null);
  const [saving, setSaving] = useState(false);
  const form = useForm({});
  const s = form.values;

  useEffect(() => {
    if (!vehicleId) return setVehicle(null);
    api.vehicle(vehicleId).then(v => {
      setVehicle(v);
      form.setValues({
        sale_type: v.sale_type || 'Local', sale_date: v.sale_date || today(), sale_price: v.sale_price ?? v.asking_price ?? '',
        sale_expense: v.sale_expense ?? '', buyer_party_id: v.buyer_party_id, buyer_name: v.buyer_name, buyer_contact: v.buyer_contact, buyer_address: v.buyer_address,
        buyer_id_no: v.buyer_id_no, payment_method: v.payment_method || 'Cash', amount_received: v.amount_received ?? '',
        destination_country: v.destination_country, port: v.port, shipping_ref: v.shipping_ref, sale_notes: v.sale_notes,
      });
    }).catch(e => toast(e.message, 'error'));
  }, [vehicleId]);

  // Copy the party's details onto the sale; international buyers default the sale to Export with their country/port
  const pickBuyer = party => {
    if (!party) return form.setValues(x => ({ ...x, buyer_party_id: '', buyer_name: '', buyer_contact: '', buyer_id_no: '', buyer_address: '' }));
    const intl = party.scope === 'International';
    form.setValues(x => ({
      ...x,
      buyer_party_id: party.id,
      buyer_name: party.company_name || party.name,
      buyer_contact: [party.phone, party.email].filter(Boolean).join(' · '),
      buyer_id_no: [party.id_type, party.id_no].filter(Boolean).join(': ') || null,
      buyer_address: [party.address, party.city, party.state, party.postal_code, intl ? party.country : null].filter(Boolean).join(', '),
      ...(intl ? { sale_type: 'Export', destination_country: party.country || x.destination_country, port: party.port || x.port } : {}),
    }));
  };

  const profit = vehicle ? n(s.sale_price) - n(vehicle.total_cost) - n(s.sale_expense) : 0;
  const balance = n(s.sale_price) - n(s.amount_received);
  const editing = vehicle?.status === 'Sold';

  async function submit(e) {
    e.preventDefault();
    if (!s.sale_type || !s.sale_date || !n(s.sale_price) || !s.buyer_party_id) return toast('Sale type, date, price and buyer are required', 'error');
    if (n(s.amount_received) > n(s.sale_price)) return toast('Amount received cannot exceed the sale price', 'error');
    setSaving(true);
    try {
      const saved = await api.updateVehicle(vehicle.id, { ...s, status: 'Sold' });
      toast(`Sale saved · ${saved.invoice_no}`);
      nav(`/vehicles/${saved.id}/invoice`);
    } catch (err) {
      toast(err.message, 'error');
      setSaving(false);
    }
  }

  const p = { form };
  return (
    <form id="sale-form" onSubmit={submit}>
      <PageHeader title={editing ? `Edit Sale · ${vehicle.invoice_no || ''}` : 'Sell Vehicle'}
        subtitle="Record the sale, then print the invoice"
        actions={<>
          <Button onClick={() => nav(-1)}>Cancel</Button>
          <Button variant="primary" type="submit" form="sale-form" disabled={!vehicle || saving}>{saving ? 'Saving…' : 'Save & Print Invoice'}</Button>
        </>} />

      <Panel title="1. Vehicle">
        {!id && (
          <FormGrid>
            <Field label="Select available vehicle" wide>
              <Dropdown value={vehicleId} onChange={setVehicleId} loadOptions={loadAvailable} sortable
                placeholder="Search by stock #, chassis, make or model…" />
            </Field>
          </FormGrid>
        )}
        {vehicleId && !vehicle && <Loader />}
        {vehicle && (
          <div className="sale-vehicle">
            <Thumb name={vehicle.images?.[0]?.file_name} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="sale-vehicle-title">
                <strong>{vehicleTitle(vehicle)}</strong><GradeBadge grade={vehicle.auction_grade} interior={vehicle.interior_grade} />
              </div>
              <InfoList items={[
                ['Stock #', vehicle.stock_no], ['Chassis', vehicle.chassis_no], ['Color', vehicle.color],
                ['Mileage', vehicle.mileage != null ? `${vehicle.mileage.toLocaleString()} km` : null], ['Total Cost', money(vehicle.total_cost)],
                ['Asking', money(vehicle.asking_price)],
              ]} />
            </div>
          </div>
        )}
      </Panel>

      {vehicle && <>
        <Panel title="2. Sale Details">
          <FormGrid>
            <Select {...p} name="sale_type" label="Sale Type *" options={SALE_TYPES} placeholder={false} searchable={false} />
            <DateField {...p} name="sale_date" label="Sale Date *" min={vehicle.purchase_date || undefined} max={today()} />
            <Input {...p} name="sale_price" label="Sale Price *" type="number" min="0" step="any" />
          </FormGrid>
          {s.sale_type === 'Export' && (
            <div style={{ marginTop: 12 }}>
              <FormGrid>
                <Select {...p} name="destination_country" label="Destination Country" loadOptions={loadField('destination_country')} creatable sortable />
                <Select {...p} name="port" label="Destination Port" loadOptions={loadField('port')} creatable sortable />
                <Input {...p} name="shipping_ref" label="Shipping Ref / B/L No" />
              </FormGrid>
            </div>
          )}
        </Panel>

        <Panel title="3. Buyer">
          <FormGrid>
            <Field label="Buyer *" wide>
              <PartyPicker role="Buyer" value={s.buyer_party_id} onSelect={pickBuyer} />
            </Field>
          </FormGrid>
          {s.buyer_party_id && (
            <div style={{ marginTop: 12 }}>
              <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>Printed on this invoice (edit here for this sale only, or update the party profile for future sales)</div>
              <FormGrid>
                <Input {...p} name="buyer_name" label="Name on Invoice" />
                <Input {...p} name="buyer_contact" label="Phone / Email" />
                <Input {...p} name="buyer_id_no" label={s.sale_type === 'Export' ? 'Passport / Company Reg No' : 'CNIC / ID No'} />
                <TextArea {...p} name="buyer_address" label="Address" rows={2} />
              </FormGrid>
            </div>
          )}
        </Panel>

        <Panel title="4. Payment">
          <FormGrid>
            <Select {...p} name="payment_method" label="Payment Method" options={PAYMENT_METHODS} />
            <Input {...p} name="amount_received" label="Amount Received" type="number" min="0" step="any" />
            <Field label="Balance Due">
              <div className={`readonly-value ${balance > 0 ? 'neg' : 'pos'}`}>{money(balance)}</div>
            </Field>
            <TextArea {...p} name="sale_notes" label="Remarks (printed on invoice)" rows={2} />
          </FormGrid>
        </Panel>

        <StatGrid>
          <StatCard label="Sale Price" value={money(n(s.sale_price))} />
          <StatCard label="Total Cost" value={money(vehicle.total_cost)} />
          <StatCard label="Profit" value={money(profit)} tone="auto" raw={profit} />
          <StatCard label="Margin" value={pct(margin(profit, n(s.sale_price)))} />
        </StatGrid>
      </>}
    </form>
  );
}
