import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { t } from '../i18n';

// Centered dialog; closes on Escape or backdrop click. `footer` renders the action buttons.
export default function Modal({ title, children, footer, onClose, width = 520 }) {
  useEffect(() => {
    const onKey = e => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Portaled to <body> so a form inside the modal is never nested in the page's form.
  // React still bubbles synthetic events through portals, so stop submits from reaching the page.
  return createPortal(
    <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && onClose()} onSubmit={e => e.stopPropagation()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title} style={{ maxWidth: width }}>
        <div className="modal-head">
          <h2>{t(title)}</h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
