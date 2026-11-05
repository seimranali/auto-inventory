import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from './api';
import { setCurrency } from './format';

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

// Mirrors the backend role matrix (lib/auth.js); the backend is the real gate, this only hides UI
export const can = (user, perm) => !!user?.permissions?.includes(perm);

export function AuthProvider({ children }) {
  const [state, setState] = useState({ user: null, company: null, loading: true });

  const loadCompany = useCallback(async () => {
    const company = await api.company();
    setCurrency(company.currency);
    setState(s => ({ ...s, company }));
    return company;
  }, []);

  const signedIn = useCallback(async user => {
    setState(s => ({ ...s, user, loading: false }));
    await loadCompany().catch(() => {});
  }, [loadCompany]);

  useEffect(() => {
    api.me().then(signedIn).catch(() => setState({ user: null, company: null, loading: false }));
    const expired = () => setState({ user: null, company: null, loading: false });
    window.addEventListener('auth:expired', expired);
    return () => window.removeEventListener('auth:expired', expired);
  }, [signedIn]);

  const value = {
    ...state,
    can: perm => can(state.user, perm),
    login: async (email, password) => signedIn(await api.login(email, password)),
    logout: async () => { await api.logout().catch(() => {}); setState({ user: null, company: null, loading: false }); },
    setUser: user => setState(s => ({ ...s, user })),
    setCompany: company => { setCurrency(company.currency); setState(s => ({ ...s, company })); },
  };
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}
