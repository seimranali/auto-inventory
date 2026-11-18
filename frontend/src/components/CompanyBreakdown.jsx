import { useAuth } from '../auth';
import { Panel } from './Layout';
import DataTable from './DataTable';
import { useCombinedView } from './CompanySwitcher';
import { t } from '../i18n';

/**
 * "By Company" panel for the combined view: one row per company, with a total row.
 * rows     [{ company_id, ...values }] from the report's byCompany
 * columns  DataTable columns for the values (key, label, align, format, total)
 * Clicking a row switches the whole app to that company.
 */
export default function CompanyBreakdown({ rows = [], columns, title = 'By Company', note }) {
  const { activeCompanies, companyName, setScope } = useAuth();
  const combined = useCombinedView();
  if (!combined) return null;
  // Every active company appears, even with nothing in the period
  const byId = Object.fromEntries(rows.map(r => [String(r.company_id), r]));
  const ids = [...new Set([...activeCompanies.map(c => String(c.id)), ...Object.keys(byId)])];
  const data = ids.map(id => ({ ...byId[id], id, company_id: id, company: companyName(id) }));
  return (
    <Panel title={title} actions={<span className="muted">{t(note || 'Click a company to view it on its own')}</span>}>
      <DataTable rows={data} onRowClick={r => setScope(r.company_id)} columns={[
        { key: 'company', label: 'Company' },
        ...columns.map(c => ({ total: c.align === 'right' ? 'sum' : undefined, ...c })),
      ]} />
    </Panel>
  );
}
