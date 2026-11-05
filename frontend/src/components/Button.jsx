import { Link } from 'react-router-dom';
import { t } from '../i18n';

// variant: 'default' | 'primary' | 'danger'. Pass `to` to render a router link.
export default function Button({ variant = 'default', to, className = '', children, ...props }) {
  const cls = `btn ${variant !== 'default' ? variant : ''} ${className}`.trim();
  children = t(children);
  if (to) return <Link to={to} className={cls} {...props}>{children}</Link>;
  return <button type="button" className={cls} {...props}>{children}</button>;
}
