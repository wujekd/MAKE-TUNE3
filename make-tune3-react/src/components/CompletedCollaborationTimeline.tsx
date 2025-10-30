import type { Timestamp } from 'firebase/firestore';
import './CompletedCollaborationTimeline.css';

type MaybeDate = Timestamp | Date | number | null | undefined;

interface CompletedCollaborationTimelineProps {
  publishedAt?: MaybeDate;
  submissionCloseAt?: MaybeDate;
  votingCloseAt?: MaybeDate;
  progress?: number;
}

const toMillis = (value: MaybeDate): number => {
  if (!value) return 0;
  if (typeof value === 'number') {
    return value > 1e12 ? value : value * 1000;
  }
  if (value instanceof Date) return value.getTime();
  if (typeof (value as Timestamp)?.toMillis === 'function') {
    return (value as Timestamp).toMillis();
  }
  return 0;
};

const formatDate = (ms: number): string => {
  if (!ms) return 'N/A';
  const date = new Date(ms);
  return date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const formatDuration = (startMs: number, endMs: number): string => {
  if (!startMs || !endMs || endMs <= startMs) return '';
  
  const diffMs = endMs - startMs;
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0 || parts.length === 0) parts.push(`${minutes}m`);
  
  return parts.join(' ');
};

export function CompletedCollaborationTimeline({
  publishedAt,
  submissionCloseAt,
  votingCloseAt,
  progress = 0
}: CompletedCollaborationTimelineProps) {
  const publishedMs = toMillis(publishedAt);
  const submissionEndMs = toMillis(submissionCloseAt);
  const votingEndMs = toMillis(votingCloseAt);

  const submissionDuration = formatDuration(publishedMs, submissionEndMs);
  const votingDuration = formatDuration(submissionEndMs, votingEndMs);

  return (
    <div className="completed-timeline">
      <div className="completed-timeline__header">Collaboration Timeline</div>
      
      <div className="completed-timeline__track">
        <div className="completed-timeline__point completed-timeline__point--start">
          <div className="completed-timeline__point-marker"></div>
          <div className="completed-timeline__point-label">Created</div>
          <div className="completed-timeline__point-date">{formatDate(publishedMs)}</div>
        </div>
        
        <div className="completed-timeline__segment">
          <div className="completed-timeline__line">
            <div className="completed-timeline__progress" style={{ width: `${Math.min(progress * 2, 100)}%` }}></div>
          </div>
          <div className="completed-timeline__duration">{submissionDuration}</div>
        </div>
        
        <div className="completed-timeline__point completed-timeline__point--start">
          <div className="completed-timeline__point-marker"></div>
          <div className="completed-timeline__point-label">
            Submission<br />Close
          </div>
          <div className="completed-timeline__point-date">{formatDate(submissionEndMs)}</div>
        </div>
        
        <div className="completed-timeline__segment">
          <div className="completed-timeline__line">
            <div className="completed-timeline__progress" style={{ width: `${Math.max(0, Math.min((progress - 50) * 2, 100))}%` }}></div>
          </div>
          <div className="completed-timeline__duration">{votingDuration}</div>
        </div>
        
        <div className="completed-timeline__point completed-timeline__point--start">
          <div className="completed-timeline__point-marker"></div>
          <div className="completed-timeline__point-label">
            Voting<br />Close
          </div>
          <div className="completed-timeline__point-date">{formatDate(votingEndMs)}</div>
        </div>
      </div>
    </div>
  );
}

