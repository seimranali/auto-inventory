import { t } from '../i18n';

// tabs: [{ id, label }]
export default function Tabs({ tabs, value, onChange }) {
  return (
    <div className="tabs no-print">
      {tabs.map(tab => (
        <button key={tab.id} type="button" className={`btn ${value === tab.id ? 'on' : ''}`} onClick={() => onChange(tab.id)}>
          {t(tab.label)}
        </button>
      ))}
    </div>
  );
}
