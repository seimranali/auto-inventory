import { useEffect, useState } from 'react';
import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { LightboxProvider, Loader } from './components';
import { HeaderSlotContext } from './components/Layout';
import TopBar from './components/TopBar';
import NavIcon from './components/NavIcon';
import AppFooter from './components/AppFooter';
import Logo from './components/Logo';
import { useAuth } from './auth';
import { fileUrl } from './api';
import LoginPage from './pages/LoginPage';
import Dashboard from './pages/Dashboard';
import Inventory from './pages/Inventory';
import VehicleForm from './pages/VehicleForm';
import VehicleDetail from './pages/VehicleDetail';
import SalePage from './pages/SalePage';
import InvoicePage from './pages/InvoicePage';
import AvailableReport from './pages/AvailableReport';
import ProfitReport from './pages/ProfitReport';
import InOutReport from './pages/InOutReport';
import PartiesPage from './pages/PartiesPage';
import PartyForm from './pages/PartyForm';
import PartyDetail from './pages/PartyDetail';
import CompanyPage from './pages/CompanyPage';
import UsersPage from './pages/UsersPage';
import RolesPage from './pages/RolesPage';
import ProfilePage from './pages/ProfilePage';
import AccountsPage from './pages/AccountsPage';
import ExpensesPage from './pages/ExpensesPage';
import LedgerPage from './pages/LedgerPage';

import { NAV } from './nav';
import { t } from './i18n';

const MOBILE_QUERY = '(max-width: 800px)';
function useMediaQuery(query) {
  const [match, setMatch] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setMatch(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [query]);
  return match;
}

const readCollapsed =() => { try { return localStorage.getItem('sidebarCollapsed') === '1'; } catch { return false; } };

function Forbidden() {
  return (
    <div className="empty forbidden">
      <NavIcon name="shield" size={40} />
      <h2>{t('No access')}</h2>
      <p>{t("Your role doesn't include this page. Ask an administrator if you need access.")}</p>
    </div>
  );
}

export default function App() {
  const { user, loading, can, company } = useAuth();
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [headerSlot, setHeaderSlot] = useState(null);
  const isMobile = useMediaQuery(MOBILE_QUERY);
  const [drawer, setDrawer] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => setDrawer(false), [pathname, isMobile]);
  useEffect(() => {
    if (!drawer) return;
    const onKey = e => e.key === 'Escape' && setDrawer(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [drawer]);
  // On phones the toggle opens an off-canvas drawer instead of collapsing the rail
  const toggle = () => isMobile ? setDrawer(d => !d) : setCollapsed(c => {
    try { localStorage.setItem('sidebarCollapsed', c ? '0' : '1'); } catch { /* storage unavailable */ }
    return !c;
  });

  if (loading) return <div className="boot"><Loader /></div>;
  if (!user) return <LoginPage />;

  // Drop items the role can't use, then drop section headings left with no items
  const nav = NAV.filter(n => n.head || can(n.perm))
    .filter((n, i, arr) => !n.head || (arr[i + 1] && !arr[i + 1].head));
  const home = can('reports:read') ? '/dashboard' : '/inventory';
  const guarded = (perm, el) => (can(perm) ? el : <Forbidden />);

  return (
    <LightboxProvider>
      {isMobile && drawer && <div className="sidebar-backdrop no-print" onClick={() => setDrawer(false)} />}
      <aside className={`sidebar no-print ${collapsed && !isMobile ? 'collapsed' : ''} ${drawer ? 'open' : ''}`}>
        <div className="brand">
          {company?.logo ? <img className="brand-logo" src={fileUrl(company.logo)} alt="" /> : <Logo size={34} />}
          <span className="brand-text" title={company?.name}>{company?.logo && company?.name ? company.name : t('Auto Inventory')}</span>
        </div>
        <nav>
          {nav.map(n => n.head
            ? <div key={n.head} className="nav-head"><span>{t(n.head)}</span></div>
            : (
              <NavLink key={n.to} to={n.to} end title={collapsed && !isMobile ? t(n.label) : undefined}>
                <NavIcon name={n.icon} size={20} /><span className="nav-label">{t(n.label)}</span>
              </NavLink>
            ))}
        </nav>
      </aside>
      <div className="shell">
      <TopBar collapsed={isMobile ? !drawer : collapsed} onToggle={toggle} />
      <main>
        <div ref={setHeaderSlot} className="page-header-slot" />
        <div className="main-scroll">
        <HeaderSlotContext.Provider value={headerSlot}>
        <Routes>
          <Route path="/" element={<Navigate to={home} replace />} />
          <Route path="/dashboard" element={guarded('reports:read', <Dashboard />)} />
          <Route path="/inventory" element={guarded('vehicles:read', <Inventory />)} />
          <Route path="/vehicles/new" element={guarded('vehicles:write', <VehicleForm />)} />
          <Route path="/vehicles/:id" element={guarded('vehicles:read', <VehicleDetail />)} />
          <Route path="/vehicles/:id/edit" element={guarded('vehicles:write', <VehicleForm />)} />
          <Route path="/sales/new" element={guarded('sales:write', <SalePage />)} />
          <Route path="/vehicles/:id/sell" element={guarded('sales:write', <SalePage />)} />
          <Route path="/vehicles/:id/invoice" element={guarded('vehicles:read', <InvoicePage />)} />
          <Route path="/parties" element={guarded('vehicles:read', <PartiesPage />)} />
          <Route path="/parties/new" element={can('vehicles:write') || can('sales:write') ? <PartyForm /> : <Forbidden />} />
          <Route path="/parties/:id" element={guarded('vehicles:read', <PartyDetail />)} />
          <Route path="/parties/:id/edit" element={can('vehicles:write') || can('sales:write') ? <PartyForm /> : <Forbidden />} />
          <Route path="/accounts" element={guarded('accounts:manage', <AccountsPage />)} />
          <Route path="/accounts/expenses" element={guarded('accounts:manage', <ExpensesPage />)} />
          <Route path="/accounts/ledger" element={guarded('accounts:manage', <LedgerPage />)} />
          <Route path="/reports/available" element={guarded('reports:read', <AvailableReport />)} />
          <Route path="/reports/profit" element={guarded('reports:read', <ProfitReport />)} />
          <Route path="/reports/in-out" element={guarded('reports:read', <InOutReport />)} />
          <Route path="/settings/company" element={guarded('company:manage', <CompanyPage />)} />
          <Route path="/settings/users" element={guarded('users:manage', <UsersPage />)} />
          <Route path="/settings/roles" element={guarded('users:manage', <RolesPage />)} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="*" element={<Navigate to={home} replace />} />
        </Routes>
        </HeaderSlotContext.Provider>
        </div>
        <AppFooter />
      </main>
      </div>
    </LightboxProvider>
  );
}
