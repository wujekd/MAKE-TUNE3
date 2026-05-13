import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { StageStatusProgress } from './StageStatusProgress';
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
  footerSlot?: ReactNode;
  footerMetaSlot?: ReactNode;
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
  footerSlot,
  footerMetaSlot,
  statusIndicator: _statusIndicator,
  rightSlot,
  isSelected,
  isActive,
  progressPercent: _progressPercent,
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

  const status = stageInfo?.status || (subtitle ? String(subtitle) : '');

  const content = (
    <>
      <div className="collab-list-item__main">
        <div className="collab-list-item__header">
          <div className="collab-list-item__title-block">
            <span className="collab-list-item__title">{title}</span>
          </div>
          {status && (
            <StageStatusProgress
              status={status}
              startAt={stageInfo?.startAt}
              endAt={stageInfo?.endAt}
              className="collab-list-item__status-progress"
            />
          )}
        </div>

        {children}
      </div>
      {(rightSlot || footerSlot || footerMetaSlot) && (
        <div className="collab-list-item__audio-row">
          {rightSlot && <div className="collab-list-item__right">{rightSlot}</div>}
          {footerSlot && <div className="collab-list-item__footer">{footerSlot}</div>}
          {footerMetaSlot && <div className="collab-list-item__footer-meta">{footerMetaSlot}</div>}
        </div>
      )}
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
