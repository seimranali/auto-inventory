import { useState } from 'react';
import { useAuth } from '../auth';
import NavIcon from '../components/NavIcon';
import AppFooter from '../components/AppFooter';
import Logo from '../components/Logo';
import { t, LangSwitch } from '../i18n';

export default function LoginPage() {
  const { login } = useAuth();
  const [form, setForm] = useState({ email: '', password: '' });
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (!form.email || !form.password) return setError(t('Enter your email and password'));
    setBusy(true);
    setError('');
    try {
      await login(form.email.trim(), form.password);
    } catch (err) {
      setError(t(err.message));
      setBusy(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-art" aria-hidden="true">
        <div className="login-art-inner">
          <Logo size={56} className="login-logo" />
          <h2>{t('Auto Inventory')}</h2>
          <p>{t('Buy, stock and sell vehicles — locally and for export — with every cost, auction grade and profit in one place.')}</p>
          <ul>
            <li><NavIcon name="inventory" size={20} /> {t('Full vehicle records with auction sheets & photos')}</li>
            <li><NavIcon name="profit" size={20} /> {t('Profit, margin and stock-aging reports')}</li>
            <li><NavIcon name="inout" size={20} /> {t('Every vehicle IN and OUT, tracked')}</li>
          </ul>
        </div>
      </div>

      <form className="login-card" onSubmit={submit} noValidate>
        <Logo size={44} className="login-mark-sm" />
        <LangSwitch className="login-lang" />
        <h1>{t('Sign in')}</h1>
        <p className="muted">{t('Welcome back. Sign in to manage your inventory.')}</p>

        {error && <div className="login-error" role="alert">{error}</div>}

        <label className="login-field">
          <span>{t('Email')}</span>
          <input type="email" autoComplete="username" autoFocus value={form.email}
            onChange={e => setForm({ ...form, email: e.target.value })} placeholder="you@company.com" />
        </label>
        <label className="login-field">
          <span>{t('Password')}</span>
          <div className="pw-wrap">
            <input type={show ? 'text' : 'password'} autoComplete="current-password" value={form.password}
              onChange={e => setForm({ ...form, password: e.target.value })} placeholder="••••••••" />
            <button type="button" onClick={() => setShow(s => !s)} aria-label={show ? 'Hide password' : 'Show password'}>
              {t(show ? 'Hide' : 'Show')}
            </button>
          </div>
        </label>

        <button type="submit" className="btn primary login-submit" disabled={busy}>{t(busy ? 'Signing in…' : 'Sign in')}</button>
        <p className="login-foot muted">{t('Forgot your password? Ask your administrator to reset it.')}</p>
        <AppFooter className="login-footer" />
      </form>
    </div>
  );
}
