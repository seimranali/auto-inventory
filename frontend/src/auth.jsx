import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, setCompanyScope } from './api';
import { setCurrency } from './format';

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

// Mirrors the backend role matrix (lib/auth.js); the backend is the real gate, this only hides UI
export const can = (user, perm) => !!user?.permissions?.includes(perm);

// Company being viewed, remembered per browser: a company id, or 'all' for every company combined
const SCOPE_KEY = 'companyScope';
const readScope = () => { try { return localStorage.getItem(SCOPE_KEY) || 'all'; } catch { return 'all'; } };
const saveScope = s => { try { localStorage.setItem(SCOPE_KEY, s); } catch { /* storage unavailable */ } };

// A saved scope that no longer matches an active company falls back to all companies
const validScope = (scope, companies) =>
  (scope !== 'all' && companies.some(c => String(c.id) === String(scope) && c.active !== 0) ? String(scope) : 'all');

export function AuthProvider({ children }) {
  const [state, setState] = useState({ user: null, companies: [], scope: 'all', loading: true });

  const applyScope = (scope, companies) => {
    const s = validScope(scope, companies);
    setCompanyScope(s === 'all' ? null : s);
    const main = companies.reduce((a, c) => (!a || c.id < a.id ? c : a), null);
    setCurrency((companies.find(c => String(c.id) === s) || main)?.currency);
    return s;
  };

  const loadCompanies = useCallback(async () => {
    const companies = await api.companies();
    setState(s => ({ ...s, companies, scope: applyScope(s.scope, companies) }));
    return companies;
  }, []);

  const signedIn = useCallback(async user => {
    const scope = readScope();
    setCompanyScope(scope === 'all' ? null : scope);
    setState(s => ({ ...s, user, scope }));
    await loadCompanies().catch(() => {});
    setState(s => ({ ...s, loading: false }));
  }, [loadCompanies]);

  useEffect(() => {
    api.me().then(signedIn).catch(() => setState(s => ({ ...s, user: null, loading: false })));
    const expired = () => setState(s => ({ ...s, user: null, loading: false }));
    window.addEventListener('auth:expired', expired);
    return () => window.removeEventListener('auth:expired', expired);
  }, [signedIn]);

  const { companies, scope } = state;
  const main = companies.reduce((a, c) => (!a || c.id < a.id ? c : a), null);
  const activeCompanies = companies.filter(c => c.active !== 0);
  const companyOf = id => companies.find(c => String(c.id) === String(id)) || main;
  const scopedCompany = scope === 'all' ? null : companyOf(scope);

  const value = {
    ...state,
    can: perm => can(state.user, perm),
    login: async (email, password) => signedIn(await api.login(email, password)),
    logout: async () => { await api.logout().catch(() => {}); setState(s => ({ ...s, user: null })); },
    setUser: user => setState(s => ({ ...s, user })),

    // Multi-company
    activeCompanies,
    multiCompany: companies.length > 1,
    mainCompany: main,
    // Company used for branding, currency and new records: the one being viewed, else the main company
    company: scopedCompany || main,
    // Company being viewed (null = all companies combined)
    scopedCompany,
    companyOf,
    companyName: id => { const c = companyOf(id); return c?.name_en || c?.name || '-'; },
    setScope: s => { saveScope(String(s)); setState(st => ({ ...st, scope: applyScope(String(s), st.companies) })); },
    reloadCompanies: loadCompanies,
    // After saving a company profile
    setCompany: company => setState(s => {
      const list = s.companies.some(c => c.id === company.id) ? s.companies.map(c => (c.id === company.id ? company : c)) : [...s.companies, company];
      return { ...s, companies: list, scope: applyScope(s.scope, list) };
    }),
  };
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}
