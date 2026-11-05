import { createContext, useContext, useEffect, useState } from 'react';
import JA from './locales/ja';

export const LANGUAGES = [{ code: 'en', label: 'English', short: 'EN' }, { code: 'ja', label: '日本語', short: '日本語' }];
const KEY = 'lang';
const read = () => { try { return localStorage.getItem(KEY) || 'en'; } catch { return 'en'; } };

// Module-level so plain functions (column definitions, formatters) can translate during render
let current = read();
export const getLang = () => current;

/**
 * Translate by English source text; anything missing falls back to the English.
 * Supports {placeholders}: t('{n} records', { n: 5 }).
 */
export function t(text, vars) {
  if (typeof text !== 'string') return text;
  let out = current === 'ja' ? (JA[text] ?? text) : text;
  if (vars) out = out.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? ''));
  return out;
}

const LangCtx = createContext({ lang: 'en', setLang: () => {} });
export const useLang = () => useContext(LangCtx);

export function LangProvider({ children }) {
  const [lang, setLangState] = useState(current);
  useEffect(() => { document.documentElement.lang = lang; }, [lang]);
  const setLang = code => {
    current = code;
    try { localStorage.setItem(KEY, code); } catch { /* storage unavailable */ }
    setLangState(code);
  };
  // key={lang} remounts the app so every t() call re-renders in the new language
  return <LangCtx.Provider value={{ lang, setLang }}><div key={lang} style={{ display: 'contents' }}>{children}</div></LangCtx.Provider>;
}

export function LangSwitch({ className = '' }) {
  const { lang, setLang } = useLang();
  return (
    <div className={`lang-switch ${className}`} role="radiogroup" aria-label="Language / 言語">
      {LANGUAGES.map(l => (
        <button key={l.code} type="button" role="radio" aria-checked={lang === l.code} className={lang === l.code ? 'on' : ''}
          onClick={() => setLang(l.code)} title={l.label}>{l.short}</button>
      ))}
    </div>
  );
}
