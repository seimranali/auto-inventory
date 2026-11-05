import Dropdown from './Dropdown';
import { t } from '../i18n';
import { DatePicker } from './DatePicker';

// Controlled form inputs bound to a `values` object by `name`.
// Usage: <Input name="make" label="Make" form={form} />  where form = useForm(...)

export function Field({ label, wide, children, hint }) {
  // A div, not a <label>, so clicks inside a Dropdown panel don't retrigger its button
  return (
    <div className={`field ${wide ? 'wide' : ''}`}>
      {t(label)}
      {children}
      {hint && <span className="field-hint">{t(hint)}</span>}
    </div>
  );
}

export function Input({ form, name, label, wide, hint, type = 'text', ...props }) {
  return (
    <Field label={label} wide={wide} hint={hint}>
      <input type={type} value={form.values[name] ?? ''} onChange={e => form.set(name, e.target.value)} {...props} placeholder={t(props.placeholder)} />
    </Field>
  );
}

// Form-bound Dropdown; accepts every Dropdown prop (options, loadOptions, groupBy, sort, creatable…)
// placeholder={false} makes the field required-style (not clearable)
export function Select({ form, name, label, wide, hint, placeholder = '— Select —', onChange, ...props }) {
  return (
    <Field label={label} wide={wide} hint={hint}>
      <Dropdown value={form.values[name] ?? ''} placeholder={placeholder || '— Select —'} clearable={placeholder !== false}
        onChange={v => { form.set(name, v); onChange?.(v); }} {...props} />
    </Field>
  );
}

export function DateField({ form, name, label, wide, hint, onChange, ...props }) {
  return (
    <Field label={label} wide={wide} hint={hint}>
      <DatePicker value={form.values[name] ?? ''} onChange={v => { form.set(name, v); onChange?.(v); }} {...props} />
    </Field>
  );
}

export function TextArea({ form, name, label, wide = true, ...props }) {
  return (
    <Field label={label} wide={wide}>
      <textarea value={form.values[name] ?? ''} onChange={e => form.set(name, e.target.value)} {...props} />
    </Field>
  );
}

export function FormGrid({ children }) {
  return <div className="grid">{children}</div>;
}

// Read-only label/value list for detail pages: items = [[label, value], ...]
export function InfoList({ items }) {
  return (
    <dl className="info-list">
      {items.filter(([, v]) => v !== undefined).map(([k, v]) => (
        <div key={k}>
          <dt>{t(k)}</dt>
          <dd>{v === null || v === '' ? '-' : v}</dd>
        </div>
      ))}
    </dl>
  );
}
