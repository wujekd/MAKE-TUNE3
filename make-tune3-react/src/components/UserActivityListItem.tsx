import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { StageStatusProgress } from './StageStatusProgress';
import './UserActivityListItem.css';

export interface UserActivityStageInfo {
  status: string;
  startAt?: number | null;
  endAt?: number | null;
  label?: string;
}

type UserActivitySubmissionTone = 'submitted' | 'missing' | 'deleted';

interface UserActivityListItemProps {
  title: ReactNode;
  subtitle?: ReactNode;
  status?: string;
  metaLines?: string[];
  deadlineLabel?: string;
  deadlineDetail?: string;
  submissionLabel?: string;
  submissionTone?: UserActivitySubmissionTone;
  to?: string | null;
  actionLabel?: string;
  disabled?: boolean;
  stageInfo?: UserActivityStageInfo | null;
  className?: string;
}

const merge = (...values: Array<string | false | null | undefined>) =>
  values.filter(Boolean).join(' ');

export function UserActivityListItem({
  title,
  subtitle,
  status,
  metaLines,
  deadlineLabel,
  deadlineDetail,
  submissionLabel,
  submissionTone = 'missing',
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
  const progressStatus = stageInfo?.status || status || '';

  const body = (
    <div className="user-activity-list-item__body">
      <div className="user-activity-list-item__header">
        <span className="user-activity-list-item__title">{title}</span>
      </div>

      {subtitle && <span className="user-activity-list-item__subtitle">{subtitle}</span>}

      <div className="user-activity-list-item__timeline-row">
        {progressStatus ? (
          <StageStatusProgress
            status={progressStatus}
            startAt={stageInfo?.startAt}
            endAt={stageInfo?.endAt}
            className="user-activity-list-item__timeline-progress"
          />
        ) : (
          <span className="collab-status-label stage-status-progress user-activity-list-item__timeline-progress user-activity-list-item__timeline-progress--empty">
            <span className="stage-status-progress__text">Unknown</span>
            <span className="stage-status-progress__percent">0%</span>
          </span>
        )}
        <span
          className="user-activity-list-item__deadline-pill"
          title={deadlineDetail || deadlineLabel || undefined}
        >
          {deadlineLabel || 'deadline unavailable'}
        </span>
      </div>

      <div className="user-activity-list-item__submission-row">
        <span
          className={merge(
            'user-activity-list-item__submission-pill',
            `user-activity-list-item__submission-pill--${submissionTone}`
          )}
        >
          {submissionLabel || 'not submitted yet'}
        </span>
      </div>

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
