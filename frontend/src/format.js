import { CURRENCY } from './constants';

const moneyFmt = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

// Currency comes from the company profile once logged in; CURRENCY is the fallback
let currency = CURRENCY;
export const setCurrency = c => { currency = c || CURRENCY; };
export const getCurrency = () => currency;

export const money = n => (n == null || n === '' ? '-' : `${currency} ${moneyFmt.format(Number(n))}`);
// Short form for chart axes and tight spaces: 6455000 -> "6.5M"
export const compact = n => {
  const a = Math.abs(n), s = n < 0 ? '-' : '';
  if (a >= 1e9) return `${s}${+(a / 1e9).toFixed(1)}B`;
  if (a >= 1e6) return `${s}${+(a / 1e6).toFixed(1)}M`;
  if (a >= 1e3) return `${s}${+(a / 1e3).toFixed(0)}K`;
  return `${s}${a}`;
};
// One-line postal address. Japan: 〒100-0001 Tokyo, Chiyoda-ku, Chiyoda 1-1-1, Auto Bldg 5F
export const formatAddress = o => (o?.country === 'Japan'
  ? [o.postal_code && `〒${o.postal_code}`, o.prefecture, o.city, o.address, o.building]
  : [o?.address, o?.city, o?.state, o?.postal_code]).filter(Boolean).join(', ');

export const JP_ACCOUNT_LABEL = { Ordinary: '普通', Current: '当座', Savings: '貯蓄' };

export const num = n => (n == null || n === '' ? '-' : moneyFmt.format(Number(n)));
export const pct = n => (n == null || !isFinite(n) ? '-' : `${(n * 100).toFixed(1)}%`);
export const margin = (profit, revenue) => (revenue ? profit / revenue : null);
export const vehicleTitle = v => [v.year, v.make, v.model, v.variant].filter(Boolean).join(' ') || 'Untitled vehicle';
export { todayIso as today } from './dates';

export function daysInStock(v) {
  if (!v.purchase_date) return null;
  const end = v.status === 'Sold' && v.sale_date ? new Date(v.sale_date) : new Date();
  return Math.max(0, Math.round((end - new Date(v.purchase_date)) / 86400000));
}
