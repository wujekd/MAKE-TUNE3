import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  clampStageProgress,
  computeStageProgress,
  formatStageDisplay
} from './ItemStageProgressBar';
import './CollabStatusLabel.css';
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

function CollabStatusProgress({
  status,
  startAt,
  endAt
}: {
  status: string;
  startAt?: number | null;
  endAt?: number | null;
}) {
  const targetProgress = useMemo(
    () => computeStageProgress(status, startAt, endAt),
    [status, startAt, endAt]
  );
  const [progress, setProgress] = useState(targetProgress);
  const statusKey = status.trim().toLowerCase().replace(/\s+/g, '-');
  const percent = Math.round(clampStageProgress(progress) * 100);

  useEffect(() => {
    setProgress(targetProgress);
  }, [targetProgress]);

  useEffect(() => {
    const next = computeStageProgress(status, startAt, endAt);
    setProgress(next);

    const isCompleted = status.trim().toLowerCase() === 'completed';
    if (isCompleted || next >= 1) {
      return;
    }

    const hasTimedStage =
      typeof startAt === 'number' &&
      Number.isFinite(startAt) &&
      startAt > 0 &&
      typeof endAt === 'number' &&
      Number.isFinite(endAt) &&
      endAt > startAt;

    if (!hasTimedStage) {
      return;
    }

    const id = window.setInterval(() => {
      setProgress(computeStageProgress(status, startAt, endAt));
    }, 1000);
    return () => window.clearInterval(id);
  }, [status, startAt, endAt]);

  return (
    <div
      className={merge(
        'collab-status-label',
        'collab-list-item__status-progress',
        `collab-list-item__status-progress--${statusKey || 'default'}`
      )}
      role="progressbar"
      aria-label={`${formatStageDisplay(status)} progress`}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      style={{ '--collab-status-progress': `${percent}%` } as CSSProperties}
      data-testid="collab-status-progress"
    >
      <span className="collab-list-item__status-progress-fill" aria-hidden="true" />
      <span className="collab-list-item__status-progress-gloss" aria-hidden="true" />
      <span className="collab-list-item__status-progress-text">{formatStageDisplay(status)}</span>
      <span className="collab-list-item__status-progress-percent">{percent}%</span>
    </div>
  );
}

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
            <CollabStatusProgress
              status={status}
              startAt={stageInfo?.startAt}
              endAt={stageInfo?.endAt}
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
