import { GRADE_HELP } from '../constants';
import { t } from '../i18n';

export function Badge({ className = '', title, children }) {
  return <span className={`badge ${className}`} title={title}>{children}</span>;
}

export function StatusBadge({ status }) {
  if (!status) return null;
  return <Badge className={`b-${status.replace(/\s/g, '')}`}>{t(status)}</Badge>;
}

export function GradeBadge({ grade, interior }) {
  if (!grade && !interior) return <span className="muted">-</span>;
  return (
    <Badge className="b-grade" title={GRADE_HELP[grade]}>
      {grade || '?'}{interior ? ` / ${interior}` : ''}
    </Badge>
  );
}

export function SaleTypeBadge({ type }) {
  if (!type) return <span className="muted">-</span>;
  return <Badge className={type === 'Export' ? 'b-export' : 'b-local'}>{t(type)}</Badge>;
}
