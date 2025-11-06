import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ItemStageProgressBar } from './ItemStageProgressBar';
import { CollabStatusLabel } from './CollabStatusLabel';
import './CollabListItem.css';

type StageInfo = {
  status: string;
  label?: string;
  startAt?: number | null;
  endAt?: number | null;
};

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
  stageInfo?: StageInfo | null;
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
  className,
  stageInfo
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

  const status = stageInfo?.status || (subtitle ? String(subtitle) : '');

  const content = (
    <>
      {typeof progressPercent === 'number' && progressPercent > 0 ? (
        <div className="collab-progress-overlay" style={progressStyle} />
      ) : null}
      <div className="collab-list-item__main">
        <div className="collab-list-item__header">
          <div className="collab-list-item__title-block">
            <span className="collab-list-item__title">{title}</span>
          </div>
          {rightSlot && <div className="collab-list-item__right">{rightSlot}</div>}
        </div>

        {children}

        <div className="collab-list-item__stage-row">
          {status && <CollabStatusLabel status={status} />}
          {stageInfo?.label && (
            <span className="collab-list-item__stage-label">{stageInfo.label}</span>
          )}
        </div>
        {stageInfo && (stageInfo.status === 'submission' || stageInfo.status === 'voting') && (
          <ItemStageProgressBar
            status={stageInfo.status}
            startAt={stageInfo.startAt}
            endAt={stageInfo.endAt}
          />
        )}
      </div>
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
