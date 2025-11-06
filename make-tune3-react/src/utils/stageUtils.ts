import type { Timestamp } from 'firebase/firestore';

type Milliseconds = number | null;

type TimestampLike = Timestamp | { toMillis?: () => number } | number | null | undefined;

export interface StageComputationInput {
  status?: string | null;
  submissionCloseAt?: TimestampLike;
  votingCloseAt?: TimestampLike;
  submissionDurationMs?: Milliseconds;
  votingDurationMs?: Milliseconds;
  publishedAt?: TimestampLike;
  updatedAt?: TimestampLike;
}

export interface StageInfo {
  status: string;
  startAt: Milliseconds;
  endAt: Milliseconds;
  label: string | null;
}

const toMillis = (value: TimestampLike): Milliseconds => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof (value as Timestamp).toMillis === 'function') {
    try {
      return (value as Timestamp).toMillis();
    } catch {
      return null;
    }
  }
  return (value as { toMillis?: () => number }).toMillis?.() ?? null;
};

const formatLabel = (prefix: string, millis: Milliseconds): string | null => {
  if (!millis) return null;
  const date = new Date(millis);
  if (Number.isNaN(date.getTime())) return null;
  return `${prefix} ${date.toLocaleString()}`;
};

export const computeStageInfo = (input: StageComputationInput): StageInfo | null => {
  const status = String(input.status ?? '').toLowerCase();

  if (status === 'submission') {
    const end = toMillis(input.submissionCloseAt);
    if (!end) return null;

    const duration = typeof input.submissionDurationMs === 'number'
      ? input.submissionDurationMs
      : null;

    const start = duration != null
      ? end - duration
      : toMillis(input.publishedAt);

    return {
      status,
      startAt: start,
      endAt: end,
      label: formatLabel('submission ends', end),
    };
  }

  if (status === 'voting') {
    const end = toMillis(input.votingCloseAt);
    if (!end) return null;

    const duration = typeof input.votingDurationMs === 'number'
      ? input.votingDurationMs
      : null;

    const start = duration != null
      ? end - duration
      : toMillis(input.submissionCloseAt);

    return {
      status,
      startAt: start,
      endAt: end,
      label: formatLabel('voting ends', end),
    };
  }

  if (status === 'completed') {
    const end =
      toMillis(input.votingCloseAt) ??
      toMillis(input.submissionCloseAt) ??
      toMillis(input.updatedAt);

    if (!end) return null;

    return {
      status,
      startAt: end,
      endAt: end,
      label: formatLabel('completed', end) ?? 'completed',
    };
  }

  return null;
};
