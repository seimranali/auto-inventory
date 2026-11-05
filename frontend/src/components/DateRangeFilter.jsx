import { DateRangePicker, DATE_PRESETS } from './DatePicker';

// value: { from, to }; children render extra filters on the same row
export default function DateRangeFilter({ value, onChange, children }) {
  return (
    <div className="row filters no-print">
      <DateRangePicker value={value} onChange={onChange} presets={DATE_PRESETS} placeholder="All Time" />
      {children}
    </div>
  );
}
