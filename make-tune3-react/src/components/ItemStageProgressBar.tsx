import { useEffect, useMemo, useState } from 'react';
import './ItemStageProgressBar.css';

type StageStatus = 'submission' | 'voting' | 'completed' | 'unpublished' | 'pending' | string;

interface ItemStageProgressBarProps {
  status: StageStatus;
  startAt?: number | null;
  endAt?: number | null;
  className?: string;
}

export const clampStageProgress = (value: number) => Math.max(0, Math.min(1, value));

export const formatStageDisplay = (value: StageStatus) => {
  const trimmed = String(value || '').trim();
  if (!trimmed) return 'stage';
  const parts = trimmed.replace(/[-_]+/g, ' ').split(/\s+/);
  return parts.map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
};

const normalizeMs = (value?: number | null): number | null => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null;
  return value;
};

export const computeStageProgress = (status: StageStatus, startAt?: number | null, endAt?: number | null) => {
  if (String(status).toLowerCase() === 'completed') {
    return 1;
  }

  const startMs = normalizeMs(startAt);
  const endMs = normalizeMs(endAt);
  if (!startMs || !endMs) {
    return 0;
  }
  if (endMs <= startMs) {
    return clampStageProgress(Date.now() >= endMs ? 1 : 0);
  }

  const now = Date.now();
  if (now <= startMs) return 0;
  if (now >= endMs) return 1;
  return clampStageProgress((now - startMs) / (endMs - startMs));
};

export function ItemStageProgressBar({ status, startAt, endAt, className }: ItemStageProgressBarProps) {
  const targetProgress = useMemo(() => computeStageProgress(status, startAt, endAt), [status, startAt, endAt]);
  const [progress, setProgress] = useState(targetProgress);

  useEffect(() => {
    setProgress(targetProgress);
  }, [targetProgress]);

  useEffect(() => {
    const next = computeStageProgress(status, startAt, endAt);
    setProgress(next);

    const isCompleted = String(status).toLowerCase() === 'completed';
    if (isCompleted || next >= 1) {
      return;
    }

    const startMs = normalizeMs(startAt);
    const endMs = normalizeMs(endAt);
    if (!startMs || !endMs || endMs <= startMs) {
      return;
    }

    const id = window.setInterval(() => {
      setProgress(computeStageProgress(status, startAt, endAt));
    }, 1000);
    return () => window.clearInterval(id);
  }, [status, startAt, endAt]);

  const variant = useMemo(() => {
    const key = String(status).toLowerCase();
    if (key === 'submission') return 'submission';
    if (key === 'voting') return 'voting';
    if (key === 'completed') return 'completed';
    return 'default';
  }, [status]);

  const width = `${Math.round(clampStageProgress(progress) * 100)}%`;

  return (
    <div
      className={['item-progress', className].filter(Boolean).join(' ')}
      role="progressbar"
      aria-label={`${formatStageDisplay(status)} progress`}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clampStageProgress(progress) * 100)}
    >
      <div className="item-progress__track">
        <div className={`item-progress__fill item-progress__fill--${variant}`} style={{ width }} />
      </div>
    </div>
  );
}
