import { getLang } from './i18n';

// Local-time date helpers. Values are ISO 'YYYY-MM-DD' strings; never use toISOString (UTC shifts the day).

const pad = n => String(n).padStart(2, '0');
export const toIso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const fromIso = s => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || '');
  return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
};
export const todayIso = () => toIso(new Date());
export const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
export const addMonths = (d, n) => new Date(d.getFullYear(), d.getMonth() + n, 1);

export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

export const WEEKDAYS_JA = ['月', '火', '水', '木', '金', '土', '日'];
export const MONTHS_JA = MONTHS.map((_, i) => `${i + 1}月`);
export const monthNames = () => (getLang() === 'ja' ? MONTHS_JA : MONTHS);
export const weekdayNames = () => (getLang() === 'ja' ? WEEKDAYS_JA : WEEKDAYS);

// English: 28 Oct 2026 · Japanese: 2026年10月28日
export const formatDate = s => {
  const d = fromIso(s);
  if (!d) return '';
  return getLang() === 'ja'
    ? `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`
    : `${pad(d.getDate())} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
};

// Accepts 2026-10-28, 28/10/2026, 28-10-2026, 28.10.26, "28 Oct 2026"
export function parseDate(text) {
  const t = text.trim();
  if (!t) return '';
  if (fromIso(t)) return t;
  let j = /^(\d{4})年(\d{1,2})月(\d{1,2})日?$/.exec(t);
  if (j) return valid(+j[1], +j[2] - 1, +j[3]);
  let m = /^(\d{1,2})[/.\-\s](\d{1,2})[/.\-\s](\d{2}|\d{4})$/.exec(t);
  if (m) return valid(+m[3] < 100 ? 2000 + +m[3] : +m[3], +m[2] - 1, +m[1]);
  m = /^(\d{1,2})\s+([a-z]{3})[a-z]*\s+(\d{4})$/i.exec(t);
  if (m) {
    const mi = MONTHS.findIndex(x => x.toLowerCase() === m[2].toLowerCase());
    if (mi >= 0) return valid(+m[3], mi, +m[1]);
  }
  return null;
}
function valid(y, mo, d) {
  const dt = new Date(y, mo, d);
  return dt.getMonth() === mo && dt.getDate() === d ? toIso(dt) : null;
}

// 6x7 grid of Dates for the month containing `month`, weeks starting Monday
export function monthGrid(month) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const start = addDays(first, -((first.getDay() + 6) % 7));
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}
