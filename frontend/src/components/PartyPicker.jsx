import { useRef, useState } from 'react';
import { api } from '../api';
import PartyDrawer from './PartyDrawer';
import Dropdown from './Dropdown';
import { PartyQuickAdd } from './PartyFields';

/**
 * Searchable party selector (grouped Local / International) with an "+ Add new" quick-add link in the list.
 * value: party id; onSelect(party | null) receives the full party record.
 */
export default function PartyPicker({ role, value, label, onSelect, placeholder }) {
  const cache = useRef(new Map());
  const [adding, setAdding] = useState(null); // null, or the name to prefill
  const [selected, setSelected] = useState(null);
  const [viewing, setViewing] = useState(null);

  const load = q => api.parties({ role, q, active: 1 }).then(rows => rows.map(p => {
    cache.current.set(p.id, p);
    return {
      value: p.id, label: p.name, group: p.scope,
      description: [p.code, p.scope === 'International' ? p.country : p.city, p.phone].filter(Boolean).join(' · '),
    };
  }));

  // Keep the current selection visible even before the list has loaded
  const current = value && (cache.current.get(value) || selected);
  const pick = id => {
    const p = id ? cache.current.get(id) : null;
    setSelected(p);
    onSelect(p);
  };

  return (
    <div className="party-picker">
      <div className="party-picker-row">
        <Dropdown value={value || ''} onChange={pick} loadOptions={load} sortable
          options={current ? [{ value: current.id, label: current.name, group: current.scope }] : []}
          placeholder={placeholder || `Search ${role.toLowerCase()}s by name, code, phone…`}
          action={{ label: `+ Add new ${role.toLowerCase()}`, onClick: q => setAdding(q) }} />      </div>
      {current && (
        <div className="party-chip">
          <span className={`badge ${current.scope === 'International' ? 'b-export' : 'b-local'}`}>{current.scope}</span>
          <span>{current.code}</span>
          {current.country && current.scope === 'International' && <span>· {current.country}</span>}
          {current.phone && <span>· {current.phone}</span>}
          <button type="button" className="link-btn" onClick={() => setViewing(current.id)}>View profile →</button>
        </div>
      )}
      {adding !== null && (
        <PartyQuickAdd role={role} initialName={adding} onClose={() => setAdding(null)}
          onCreated={p => { cache.current.set(p.id, p); setAdding(null); setSelected(p); onSelect(p); }} />
      )}
      {viewing && <PartyDrawer id={viewing} onClose={() => setViewing(null)} />}
      {label}
    </div>
  );
}
