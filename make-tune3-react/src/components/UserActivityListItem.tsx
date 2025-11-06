import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { CollabStatusLabel } from './CollabStatusLabel';
import { ItemStageProgressBar } from './ItemStageProgressBar';
import './UserActivityListItem.css';

export interface UserActivityStageInfo {
  status: string;
  startAt?: number | null;
  endAt?: number | null;
  label?: string;
}

interface UserActivityListItemProps {
  title: ReactNode;
  subtitle?: ReactNode;
  status?: string;
  metaLines?: string[];
  to?: string | null;
  actionLabel?: string;
  disabled?: boolean;
  stageInfo?: UserActivityStageInfo | null;
  className?: string;
}

const merge = (...values: Array<string | false | null | undefined>) =>
  values.filter(Boolean).join(' ');

const shouldShowProgress = (stageInfo?: UserActivityStageInfo | null) => {
  if (!stageInfo) return false;
  const statusKey = stageInfo.status?.toLowerCase();
  return statusKey === 'submission' || statusKey === 'voting';
};

export function UserActivityListItem({
  title,
  subtitle,
  status,
  metaLines,
  to,
  actionLabel,
  disabled,
  stageInfo,
  className
}: UserActivityListItemProps) {
  const containerClass = merge(
    'user-activity-list-item',
    disabled && 'user-activity-list-item--disabled',
    className
  );

  const body = (
    <div className="user-activity-list-item__body">
      <div className="user-activity-list-item__header">
        <span className="user-activity-list-item__title">{title}</span>
        {status && <CollabStatusLabel status={status} />}
      </div>

      {subtitle && <span className="user-activity-list-item__subtitle">{subtitle}</span>}

      {Array.isArray(metaLines) && metaLines.length > 0 && (
        <div className="user-activity-list-item__meta-column">
          {metaLines.map((line, idx) => (
            <span
              key={`${idx}-${line}`}
              className={merge(
                'user-activity-list-item__meta',
                idx > 0 && 'user-activity-list-item__meta--muted'
              )}
            >
              {line}
            </span>
          ))}
        </div>
      )}

      {shouldShowProgress(stageInfo) && (
        <div className="user-activity-list-item__progress">
          <ItemStageProgressBar
            status={stageInfo!.status}
            startAt={stageInfo!.startAt}
            endAt={stageInfo!.endAt}
          />
          {stageInfo?.label && (
            <span className="user-activity-list-item__progress-label">{stageInfo.label}</span>
          )}
        </div>
      )}
    </div>
  );

  const rightSlot = actionLabel ? (
    <span className="user-activity-list-item__action">{actionLabel}</span>
  ) : null;

  const content = (
    <>
      {body}
      {rightSlot}
    </>
  );

  if (to && !disabled) {
    return (
      <Link to={to} className={containerClass}>
        {content}
      </Link>
    );
  }

  return <div className={containerClass}>{content}</div>;
}
