import { createContext, useCallback, useContext, useRef, useState } from 'react';

const ToastCtx = createContext(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }) {
  const [msg, setMsg] = useState(null);
  const timer = useRef();
  const toast = useCallback((text, type = 'info') => {
    setMsg({ text, type });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setMsg(null), 2800);
  }, []);
  return (
    <ToastCtx.Provider value={toast}>
      {children}
      <div id="toast" className={`${msg ? 'show' : ''} ${msg?.type === 'error' ? 'toast-error' : ''}`}>{msg?.text}</div>
    </ToastCtx.Provider>
  );
}
