import { useAuth } from '../auth';
import Dropdown from './Dropdown';
import { t } from '../i18n';

// Header control: view one company, or every company combined. Hidden when there is only one company.
export default function CompanySwitcher() {
  const { multiCompany, activeCompanies, scope, setScope } = useAuth();
  if (!multiCompany) return null;
  const options = [
    { value: 'all', label: t('All companies'), description: t('Combined') },
    ...activeCompanies.map(c => ({ value: String(c.id), label: c.name, description: c.name_en && c.name_en !== c.name ? c.name_en : c.currency })),
  ];
  return (
    <div className="company-switcher" title={t('Company')}>
      <Dropdown value={scope} options={options} onChange={v => setScope(v || 'all')} clearable={false} searchable={options.length > 6} />
    </div>
  );
}

// Viewing all companies while more than one exists: tables add a Company column and reports a By Company panel
export function useCombinedView() {
  const { multiCompany, scopedCompany } = useAuth();
  return multiCompany && !scopedCompany;
}

// ['company'] when tables should show which company a row belongs to, else []
export function useCompanyColumns() {
  return useCombinedView() ? ['company'] : [];
}

// Company column for account entries (rows with company_id) in the combined view
export function useEntryCompanyColumns() {
  const { companyName } = useAuth();
  return useCombinedView() ? [{ key: 'company', label: 'Company', value: r => companyName(r.company_id), groupable: true }] : [];
}
