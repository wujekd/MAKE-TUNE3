import { useEffect, useMemo, useRef, useState } from 'react';
import type { Timestamp } from 'firebase/firestore';
import { TimerDisplay } from './TimerDisplay';
import { TimeUtils } from '../utils/timeUtils';
import { REFRESH_INTERVAL_MS } from '../config';
import './CollaborationTimeline.css';

type MaybeDate = Timestamp | Date | number | null | undefined;

type CollaborationStatus = 'unpublished' | 'submission' | 'voting' | 'completed';

interface CollaborationTimelineProps {
  status: CollaborationStatus;
  publishedAt?: MaybeDate;
  submissionCloseAt?: MaybeDate;
  votingCloseAt?: MaybeDate;
  onStageChange?: (nextStatus: 'voting' | 'completed') => void;
}

const toMillis = (value: MaybeDate): number => {
  if (!value) return 0;
  if (typeof value === 'number') {
    // treat as epoch milliseconds when large, seconds otherwise
    return value > 1e12 ? value : value * 1000;
  }
  if (value instanceof Date) return value.getTime();
  if (typeof (value as Timestamp)?.toMillis === 'function') {
    return (value as Timestamp).toMillis();
  }
  return 0;
};

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));

export function CollaborationTimeline({
  status,
  publishedAt,
  submissionCloseAt,
  votingCloseAt,
  onStageChange
}: CollaborationTimelineProps) {
  const [now, setNow] = useState(() => Date.now());
  const hasScheduledRefresh = useRef(false);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const publishedMs = toMillis(publishedAt);
  const submissionEndMs = toMillis(submissionCloseAt);
  const votingEndMs = toMillis(votingCloseAt);

  const submissionCompleted = submissionEndMs > 0 && now >= submissionEndMs;
  const votingCompleted = votingEndMs > 0 && now >= votingEndMs;
  const awaitingAdvance = (
    (status === 'submission' && submissionCompleted) ||
    (status === 'voting' && votingCompleted)
  );

  useEffect(() => {
    if (!awaitingAdvance || !onStageChange) {
      hasScheduledRefresh.current = false;
      return;
    }
    if (hasScheduledRefresh.current) return;
    hasScheduledRefresh.current = true;
    const nextStatus: 'voting' | 'completed' = status === 'submission' ? 'voting' : 'completed';
    const intervalId = window.setInterval(() => {
      console.log(`[CollaborationTimeline] awaiting advance to ${nextStatus} – requesting refresh`);
      onStageChange(nextStatus);
    }, REFRESH_INTERVAL_MS);
    return () => {
      window.clearInterval(intervalId);
      hasScheduledRefresh.current = false;
    };
  }, [awaitingAdvance, status, onStageChange]);

  const submissionCountdown = useMemo(() => {
    if (!submissionEndMs) {
      return { days: 0, hours: 0, minutes: 0, seconds: 0, completed: true };
    }
    return TimeUtils.formatCountdown(new Date(submissionEndMs));
  }, [submissionEndMs, now]);

  const votingCountdown = useMemo(() => {
    if (!votingEndMs) {
      return { days: 0, hours: 0, minutes: 0, seconds: 0, completed: true };
    }
    return TimeUtils.formatCountdown(new Date(votingEndMs));
  }, [votingEndMs, now]);

  const submissionTimer = (() => {
    if (!submissionEndMs) {
      return { days: 0, hours: 0, minutes: 0, seconds: 0, completed: true };
    }
    if (status === 'submission') {
      if (submissionCompleted) {
        return { days: 0, hours: 0, minutes: 0, seconds: 0, completed: false, closing: true };
      }
      return { ...submissionCountdown, completed: false };
    }
    return { ...submissionCountdown, completed: true };
  })();

  const votingTimer = (() => {
    if (!votingEndMs) {
      return { days: 0, hours: 0, minutes: 0, seconds: 0, completed: true };
    }
    if (status === 'submission') {
      return { days: 0, hours: 0, minutes: 0, seconds: 0, completed: false, pending: true };
    }
    if (status === 'voting') {
      if (awaitingAdvance) {
        return { days: 0, hours: 0, minutes: 0, seconds: 0, completed: false, closing: true };
      }
      return { ...votingCountdown, completed: false };
    }
    // completed or other statuses
    return { ...votingCountdown, completed: true };
  })();

  const submissionFraction = (() => {
    if (!submissionEndMs || !publishedMs || submissionEndMs <= publishedMs) {
      return submissionCompleted || status !== 'submission' ? 1 : 0;
    }
    if (submissionCompleted || status !== 'submission') return 1;
    const total = submissionEndMs - publishedMs;
    const elapsed = clamp((now - publishedMs) / total, 0, 1);
    return elapsed;
  })();

  const votingFraction = (() => {
    if (!votingEndMs || !submissionEndMs || votingEndMs <= submissionEndMs) {
      return votingCompleted || status === 'completed' ? 1 : 0;
    }
    if (status === 'completed' || votingCompleted) return 1;
    if (status === 'voting') {
      const total = votingEndMs - submissionEndMs;
      const elapsed = clamp((now - submissionEndMs) / total, 0, 1);
      return elapsed;
    }
    return 0;
  })();

  const submissionWidth = clamp(submissionFraction, 0, 1) * 50;
  const votingWidth = clamp(votingFraction, 0, 1) * 50;
  const showVotingFill = status === 'voting' || status === 'completed' || votingFraction > 0;
  const handlePosition = clamp(submissionWidth + (showVotingFill ? votingWidth : 0), 0, 100);

  return (
    <div className="collab-timeline">
      <div className="collab-timeline__phases">
        <div className="collab-timeline__phase">
          <div className="collab-timeline__label">Submission phase</div>
          <TimerDisplay {...submissionTimer} />
        </div>
        <div className="collab-timeline__phase">
          <div className="collab-timeline__label">Voting phase</div>
          <TimerDisplay {...votingTimer} />
        </div>
      </div>

      <div className="collab-timeline__bar">
        <div className="collab-progress__track">
          <div
            className="collab-progress__fill collab-progress__fill--submission"
            style={{ width: `${submissionWidth}%` }}
          />
          {showVotingFill && (
            <div
              className="collab-progress__fill collab-progress__fill--voting"
              style={{ width: `${votingWidth}%`, left: '50%' }}
            />
          )}
          <div className="collab-progress__divider" />
          <div className="collab-progress__handle" style={{ left: `${handlePosition}%` }} />
        </div>
        <div className="collab-progress__labels">
          <span>Submission</span>
          <span>Voting</span>
        </div>
      </div>

    </div>
  );
}
