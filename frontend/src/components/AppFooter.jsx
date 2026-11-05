import { useAuth } from '../auth';
import { t } from '../i18n';

// © line + "Powered by" credit; the year updates itself
export default function AppFooter({ className = '' }) {
  const { company } = useAuth();
  const owner = company?.name_en || company?.name || 'Auto Inventory';
  return (
    <footer className={`app-footer no-print ${className}`}>
      <span>© {new Date().getFullYear()} {owner}. {t('All rights reserved.')}</span>
      <span>Powered by <b>Noviq Technologies</b></span>
    </footer>
  );
}
