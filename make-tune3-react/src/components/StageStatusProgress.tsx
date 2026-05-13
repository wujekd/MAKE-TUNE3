import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import {
  clampStageProgress,
  computeStageProgress,
  formatStageDisplay
} from './ItemStageProgressBar';
import './CollabStatusLabel.css';
import './StageStatusProgress.css';

interface StageStatusProgressProps {
  status: string;
  startAt?: number | null;
  endAt?: number | null;
  className?: string;
}

const merge = (...values: Array<string | false | undefined | null>) => values.filter(Boolean).join(' ');

export function StageStatusProgress({
  status,
  startAt,
  endAt,
  className
}: StageStatusProgressProps) {
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
        'stage-status-progress',
        `stage-status-progress--${statusKey || 'default'}`,
        className
      )}
      role="progressbar"
      aria-label={`${formatStageDisplay(status)} progress`}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      style={{ '--stage-status-progress': `${percent}%` } as CSSProperties}
      data-testid="stage-status-progress"
    >
      <span className="stage-status-progress__fill" aria-hidden="true" />
      <span className="stage-status-progress__text">{formatStageDisplay(status)}</span>
      <span className="stage-status-progress__percent">{percent}%</span>
    </div>
  );
}
