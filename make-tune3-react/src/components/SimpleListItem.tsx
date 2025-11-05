import type { ReactNode } from 'react';
import './CollabListItem.css';

interface SimpleListItemProps {
  title: string;
  subtitle?: string;
  statusIndicator?: ReactNode;
  isSelected?: boolean;
  onClick?: () => void;
}

const merge = (...values: Array<string | false | undefined | null>) => values.filter(Boolean).join(' ');

export function SimpleListItem({
  title,
  subtitle,
  statusIndicator,
  isSelected,
  onClick
}: SimpleListItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={merge('collab-history-item', 'collab-list-item--button', isSelected && 'selected')}
    >
      {statusIndicator && <div className="collab-status-indicator">{statusIndicator}</div>}
      <div className="collab-info">
        <span className="collab-name">{title}</span>
        {subtitle && <span className="collab-stage">{subtitle}</span>}
      </div>
    </button>
  );
}

