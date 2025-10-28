import { useState, useEffect } from 'react';
import type { Collaboration } from '../types/collaboration';
import { CollabProgressBar } from './CollabProgressBar';
import { TimerDisplay } from './TimerDisplay';
import { TimeUtils, type CountdownResult } from '../utils/timeUtils';

interface CollabHeaderProps {
  collaboration: Collaboration | null;
}

// Helper function to safely convert Date or Timestamp to milliseconds
function toMillis(dateOrTimestamp: any): number {
  if (!dateOrTimestamp) return 0;
  if (typeof dateOrTimestamp.toMillis === 'function') {
    return dateOrTimestamp.toMillis();
  }
  if (dateOrTimestamp instanceof Date) {
    return dateOrTimestamp.getTime();
  }
  if (typeof dateOrTimestamp === 'number') {
    return dateOrTimestamp;
  }
  return 0;
}

export function CollabHeader({ collaboration }: CollabHeaderProps) {
  const [countdown, setCountdown] = useState<{ submission: CountdownResult; voting: CountdownResult }>({
    submission: { days: 0, hours: 0, minutes: 0, seconds: 0, completed: false },
    voting: { days: 0, hours: 0, minutes: 0, seconds: 0, completed: false }
  });

  useEffect(() => {
    if (!collaboration || collaboration.status === 'unpublished') return;

    const updateCountdown = () => {
      const subClose = (collaboration as any).submissionCloseAt;
      const votClose = (collaboration as any).votingCloseAt;
      setCountdown({
        submission: subClose 
          ? TimeUtils.formatCountdown(new Date(toMillis(subClose)))
          : { days: 0, hours: 0, minutes: 0, seconds: 0, completed: true },
        voting: votClose 
          ? TimeUtils.formatCountdown(new Date(toMillis(votClose)))
          : { days: 0, hours: 0, minutes: 0, seconds: 0, completed: true }
      });
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [collaboration]);

  if (!collaboration || collaboration.status === 'unpublished' || collaboration.status === 'completed') {
    return null;
  }

  const subCloseAt = (collaboration as any).submissionCloseAt;
  const votCloseAt = (collaboration as any).votingCloseAt;

  const progress = (() => {
    const now = Date.now();
    const publishedAt = toMillis(collaboration.publishedAt);
    const submissionEnd = toMillis(subCloseAt);
    const votingEnd = toMillis(votCloseAt);

    console.log('CollabHeader progress calculation:', {
      status: collaboration.status,
      now,
      publishedAt,
      submissionEnd,
      votingEnd,
      nowDate: new Date(now).toISOString(),
      publishedDate: new Date(publishedAt).toISOString(),
      submissionEndDate: new Date(submissionEnd).toISOString(),
      votingEndDate: new Date(votingEnd).toISOString()
    });

    if (collaboration.status === 'voting') {
      const votingProgress = ((now - submissionEnd) / (votingEnd - submissionEnd)) * 50;
      console.log('Voting phase:', { votingProgress, final: 50 + votingProgress });
      return 50 + votingProgress;
    } else if (collaboration.status === 'submission') {
      const submissionProgress = ((now - publishedAt) / (submissionEnd - publishedAt)) * 50;
      console.log('Submission phase:', { submissionProgress });
      return submissionProgress;
    }
    return 0;
  })();

  return (
    <div style={{ 
      backgroundColor: 'var(--primary1-600)', 
      padding: '0.5rem', 
      borderRadius: '0.5rem', 
      boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.2)',
      minWidth: '400px',
      color: 'var(--white)',
      border: '3px solid transparent'
    }}>


      {/* Content */}
      <div style={{
        backgroundColor: 'var(--primary1-700)',
        padding: '0.75rem',
        borderRadius: '0.25rem',
        boxShadow: 'inset 0 1px 3px rgba(0, 0, 0, 0.1)',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem'
      }}>
        {/* Phases Container */}
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          {/* Submission Phase - Left Half */}
          <div style={{ flex: 1 }}>
            <div style={{ 
              fontSize: '0.75rem', 
              fontWeight: 500,
              opacity: 0.7, 
              marginBottom: '0.5rem', 
              color: 'var(--white)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}>
              Submission
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <TimerDisplay 
                {...countdown.submission}
                completed={countdown.submission.completed}
              />
              <div style={{ 
                fontSize: '0.625rem', 
                opacity: 0.6, 
                textAlign: 'center', 
                color: 'var(--white)' 
              }}>
                {subCloseAt ? new Date(toMillis(subCloseAt)).toLocaleString() : 'N/A'}
              </div>
            </div>
          </div>

          {/* Voting Phase - Right Half */}
          <div style={{ flex: 1 }}>
            <div style={{ 
              fontSize: '0.75rem', 
              fontWeight: 500,
              opacity: 0.7, 
              marginBottom: '0.5rem', 
              color: 'var(--white)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}>
              Voting
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <TimerDisplay 
                {...countdown.voting}
                pending={collaboration.status === 'submission'}
                completed={countdown.voting.completed}
              />
              <div style={{ 
                fontSize: '0.625rem', 
                opacity: 0.6, 
                textAlign: 'center', 
                color: 'var(--white)' 
              }}>
                {votCloseAt ? new Date(toMillis(votCloseAt)).toLocaleString() : 'N/A'}
              </div>
            </div>
          </div>
        </div>

        <CollabProgressBar progress={progress} />
      </div>
    </div>
  );
}

