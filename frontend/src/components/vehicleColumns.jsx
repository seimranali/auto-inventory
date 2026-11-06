import { Link } from 'react-router-dom';
import { money, pct, margin, vehicleTitle, daysInStock } from '../format';
import { StatusBadge, GradeBadge, SaleTypeBadge } from './Badge';
import { Thumb } from './Media';

export const AGING_BUCKETS = ['0–30 days', '31–60 days', '61–90 days', '90+ days'];
export const agingBucket = d => (d == null ? 'Unknown' : d <= 30 ? AGING_BUCKETS[0] : d <= 60 ? AGING_BUCKETS[1] : d <= 90 ? AGING_BUCKETS[2] : AGING_BUCKETS[3]);

// Shared DataTable column definitions for vehicles; pick by key in each page/report
const defs = {
  photo: { key: 'photo', label: '', render: v => <Thumb name={v.cover} />, value: () => '', filter: false },
  stock_no: { key: 'stock_no', label: 'Stock #', render: v => <Link to={`/vehicles/${v.id}`} onClick={e => e.stopPropagation()}>{v.stock_no || '(none)'}</Link>, value: v => v.stock_no },
  vehicle: { key: 'vehicle', label: 'Vehicle', value: vehicleTitle },
  make: { key: 'make', label: 'Make', groupable: true },
  year: { key: 'year', label: 'Year', groupable: true },
  body_type: { key: 'body_type', label: 'Body', groupable: true },
  chassis_no: { key: 'chassis_no', label: 'Chassis / VIN' },
  color: { key: 'color', label: 'Color', groupable: true },
  mileage: { key: 'mileage', label: 'Mileage', align: 'right', format: n => (n == null ? '-' : `${Number(n).toLocaleString()} km`) },
  engine_cc: { key: 'engine_cc', label: 'CC', align: 'right' },
  transmission: { key: 'transmission', label: 'Trans.' },
  grade: { key: 'grade', label: 'Grade', render: v => <GradeBadge grade={v.auction_grade} interior={v.interior_grade} />, value: v => v.auction_grade, groupable: true },
  status: { key: 'status', label: 'Status', render: v => <StatusBadge status={v.status} />, value: v => v.status, groupable: true },
  location: { key: 'location', label: 'Location', groupable: true },
  purchase_date: { key: 'purchase_date', label: 'Purchased' },
  purchase_month: { key: 'purchase_month', label: 'Purchase Month', value: v => v.purchase_date?.slice(0, 7), groupable: true },
  purchase_source: { key: 'purchase_source', label: 'Source', groupable: true },
  supplier: { key: 'supplier', label: 'Supplier / Auction', value: v => v.auction_house || v.supplier },
  purchase_price: { key: 'purchase_price', label: 'Purchase', align: 'right', format: money, total: 'sum' },
  total_cost: { key: 'total_cost', label: 'Total Cost', align: 'right', format: money, total: 'sum' },
  asking_price: { key: 'asking_price', label: 'Asking', align: 'right', format: money, total: 'sum' },
  days: { key: 'days', label: 'Days', align: 'right', value: daysInStock },
  age: {
    key: 'age', label: 'Days in Stock', align: 'right', value: daysInStock,
    render: v => { const d = daysInStock(v); return d == null ? '-' : <span className={`age ${d > 60 ? 'age-old' : d > 30 ? 'age-mid' : ''}`}>{d}d</span>; },
  },
  aging_bucket: { key: 'aging_bucket', label: 'Aging', value: v => agingBucket(daysInStock(v)), groupable: true },
  expected_profit: {
    key: 'expected_profit', label: 'Expected Profit', align: 'right', total: 'sum',
    value: v => (v.asking_price ? v.asking_price - (v.total_cost || 0) : null),
    format: n => (n == null ? '-' : <span className={n > 0 ? 'pos' : n < 0 ? 'neg' : ''}>{money(n)}</span>),
  },
  sale_date: { key: 'sale_date', label: 'Sold' },
  sale_type: { key: 'sale_type', label: 'Sale Type', render: v => <SaleTypeBadge type={v.sale_type} />, value: v => v.sale_type, groupable: true },
  buyer_name: { key: 'buyer_name', label: 'Buyer' },
  destination: { key: 'destination', label: 'Destination', value: v => [v.port, v.destination_country].filter(Boolean).join(', ') },
  sale_price: { key: 'sale_price', label: 'Sale Price', align: 'right', format: money, total: 'sum' },
  profit: {
    key: 'profit', label: 'Profit', align: 'right', total: 'sum',
    format: n => <span className={n > 0 ? 'pos' : n < 0 ? 'neg' : ''}>{money(n)}</span>,
  },
  margin: {
    key: 'margin', label: 'Margin', align: 'right', percent: true, value: v => margin(v.profit, v.sale_price), format: pct,
    total: rows => pct(margin(rows.reduce((a, r) => a + (r.profit || 0), 0), rows.reduce((a, r) => a + (r.sale_price || 0), 0))),
  },
};

export const vehicleColumns = (...keys) => keys.map(k => defs[k]);
