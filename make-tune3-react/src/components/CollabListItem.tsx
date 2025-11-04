import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import './CollabListItem.css';

type CollabListItemProps = {
  to?: string;
  onClick?: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  children?: ReactNode;
  statusIndicator?: ReactNode;
  rightSlot?: ReactNode;
  isSelected?: boolean;
  isActive?: boolean;
  progressPercent?: number;
  listVariant?: boolean;
  className?: string;
};

const merge = (...values: Array<string | false | undefined | null>) => values.filter(Boolean).join(' ');

export function CollabListItem({
  to,
  onClick,
  title,
  subtitle,
  children,
  statusIndicator,
  rightSlot,
  isSelected,
  isActive,
  progressPercent,
  listVariant,
  className
}: CollabListItemProps) {
  const baseClass = merge(
    'collab-history-item',
    listVariant && 'list__item',
    isSelected && 'selected',
    isActive && 'currently-playing',
    className
  );

  const progressStyle =
    typeof progressPercent === 'number'
      ? { width: `${100 - Math.min(progressPercent, 100)}%` }
      : undefined;

  const content = (
    <>
      {typeof progressPercent === 'number' && progressPercent > 0 ? (
        <div className="collab-progress-overlay" style={progressStyle} />
      ) : null}
      {statusIndicator ? <div className="collab-status-indicator">{statusIndicator}</div> : null}
      <div className="collab-info">
        <span className={listVariant ? 'collab-name list__title' : 'collab-name'}>{title}</span>
        {subtitle ? (
          <span className={listVariant ? 'collab-stage list__subtitle' : 'collab-stage'}>
            {subtitle}
          </span>
        ) : null}
        {children}
      </div>
      {rightSlot ? <div className="collab-list-item__right">{rightSlot}</div> : null}
    </>
  );

  if (to) {
    return (
      <Link to={to} className={baseClass}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className={merge(baseClass, 'collab-list-item--button')}>
      {content}
    </button>
  );
}
