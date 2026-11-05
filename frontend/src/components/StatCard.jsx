import NavIcon from './NavIcon';
import { t } from '../i18n';

// tone: 'auto' colours the value green/red by sign. icon + accent ('blue'|'green'|'amber'|'violet') give a hero tile.
export function StatCard({ label, value, hint, tone, raw, icon, accent }) {
  const cls = tone === 'auto' ? (raw > 0 ? 'pos' : raw < 0 ? 'neg' : '') : tone || '';
  const body = (
    <>
      <div className="label">{t(label)}</div>
      <div className={`value ${cls}`}>{value}</div>
      {hint && <div className="muted hint">{t(hint)}</div>}
    </>
  );
  if (!icon) return <div className="card">{body}</div>;
  return (
    <div className={`card card-hero hero-${accent || 'blue'}`}>
      <span className={`card-icon accent-${accent || 'blue'}`}><NavIcon name={icon} size={48} /></span>
      <div className="card-body">{body}</div>
    </div>
  );
}

export function StatGrid({ children }) {
  return <div className="cards">{children}</div>;
}

// Horizontal bar breakdown: items = [{ label, value, display }]
export function BarList({ items, empty = 'No data' }) {
  const max = Math.max(...items.map(i => Math.abs(i.value) || 0), 1);
  if (!items.length) return <div className="muted">{empty}</div>;
  return (
    <div className="barlist">
      {items.map(i => (
        <div key={i.label} className="barlist-row">
          <span className="barlist-label">{t(i.label) || '—'}</span>
          <div className="barlist-track">
            <div className={`bar ${i.value < 0 ? 'bar-neg' : ''}`} style={{ width: `${(Math.abs(i.value) / max) * 100}%` }} />
          </div>
          <span className="barlist-value">{i.display ?? i.value}</span>
        </div>
      ))}
    </div>
  );
}
