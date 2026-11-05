import { createContext, useContext } from 'react';
import { createPortal } from 'react-dom';
import { t } from '../i18n';

// Page-level building blocks

// DOM node above the scroll area where PageHeader renders, so the header never scrolls
export const HeaderSlotContext = createContext(null);

// Note: the header is portaled out of the page, so submit buttons inside it
// must reference their form with the `form="<form id>"` attribute.
export function PageHeader({ title, subtitle, actions }) {
  const slot = useContext(HeaderSlotContext);
  const header = (
    <>
      <div className="print-head">
        <strong>{t('Auto Inventory')}</strong> · {new Date().toLocaleString()}
      </div>
      <div className="row spread page-header">
        <div>
          <h1>{t(title)}</h1>
          {subtitle && <div className="muted">{t(subtitle)}</div>}
        </div>
        {actions && <div className="row no-print">{actions}</div>}
      </div>
    </>
  );
  return slot ? createPortal(header, slot) : header;
}

export function Panel({ title, actions, children, className = '' }) {
  return (
    <section className={`panel ${className}`}>
      {(title || actions) && (
        <div className="row spread panel-head">
          {title && <h2>{t(title)}</h2>}
          {actions && <div className="row no-print">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

export function Loader({ text = 'Loading…' }) {
  return <div className="empty">{t(text)}</div>;
}

export function EmptyState({ children = 'Nothing to show yet.' }) {
  return <div className="empty">{t(children)}</div>;
}

export function ErrorBox({ error }) {
  return error ? <div className="error-box">{error.message || String(error)}</div> : null;
}
