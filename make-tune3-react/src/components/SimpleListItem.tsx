import type { ReactNode } from 'react';
import { CollabStatusLabel } from './CollabStatusLabel';
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
      className={merge('simple-list-item', isSelected && 'simple-list-item--selected')}
    >
      <div className="simple-list-item__content">
        <span className="simple-list-item__title">{title}</span>
        {subtitle && <CollabStatusLabel status={subtitle} />}
      </div>
    </button>
  );
}

