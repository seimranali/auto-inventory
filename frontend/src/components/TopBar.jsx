import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import NavIcon from './NavIcon';
import GlobalSearch from './GlobalSearch';
import { useAuth } from '../auth';
import { t, LangSwitch, getLang } from '../i18n';

// App header above the content area: sidebar toggle, global search, date, user menu
export default function TopBar({ collapsed, onToggle }) {
  const { user, company, logout, can } = useAuth();
  const [menu, setMenu] = useState(false);
  const menuRef = useRef();
  const date = new Date().toLocaleDateString(getLang() === 'ja' ? 'ja-JP' : 'en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });

  useEffect(() => {
    if (!menu) return;
    const onDoc = e => !menuRef.current?.contains(e.target) && setMenu(false);
    const onKey = e => e.key === 'Escape' && setMenu(false);
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [menu]);

  const initials = user.name.split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();

  return (
    <header className="topbar no-print">
      <button type="button" className="sidebar-toggle" onClick={onToggle}
        title={t(collapsed ? 'Expand sidebar' : 'Collapse sidebar')} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} aria-expanded={!collapsed}>
        <NavIcon name="menu" size={20} />
      </button>
      <GlobalSearch />
      <div className="topbar-right">
        <LangSwitch />
        <span className="topbar-date">{date}</span>
        <div className="user-menu" ref={menuRef}>
          <button type="button" className="topbar-user" onClick={() => setMenu(m => !m)} aria-haspopup="menu" aria-expanded={menu}>
            <span className="avatar">{initials}</span>
            <span className="user-meta"><b>{user.name}</b><small>{t(user.role)}</small></span>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
          </button>
          {menu && (
            <div className="user-dropdown" role="menu">
              <div className="user-dropdown-head">
                <b>{user.name}</b>
                <small>{user.email}</small>
                {company && <small className="muted">{company.name}</small>}
              </div>
              <Link role="menuitem" to="/profile" onClick={() => setMenu(false)}><NavIcon name="user" size={16} /> {t('My Profile')}</Link>
              {can('company:manage') && <Link role="menuitem" to="/settings/company" onClick={() => setMenu(false)}><NavIcon name="company" size={16} /> {t('Company')}</Link>}
              {can('users:manage') && <Link role="menuitem" to="/settings/users" onClick={() => setMenu(false)}><NavIcon name="users" size={16} /> {t('Users')}</Link>}
              <button type="button" role="menuitem" className="danger" onClick={logout}><NavIcon name="logout" size={16} /> {t('Sign out')}</button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
