import { useState, useEffect } from 'react';
import type { Collaboration, Project } from '../types/collaboration';
import { CollaborationService } from '../services';
import { CreateCollaboration } from './CreateCollaboration';
import { CollabProgressBar } from './CollabProgressBar';
import { TimerDisplay } from './TimerDisplay';

interface CollaborationDetailsProps {
  mode: 'none' | 'create' | 'view' | 'edit';
  selectedId: string | null;
  collabs: Collaboration[];
  project: Project | null;
  onModeChange: (mode: 'none' | 'create' | 'view' | 'edit') => void;
  onCollabsUpdate: (collabs: Collaboration[]) => void;
  onSelectedIdChange: (id: string | null) => void;
}

import { TimeUtils, type CountdownResult } from '../utils/timeUtils';

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

export function CollaborationDetails({
  mode,
  selectedId,
  collabs,
  project,
  onModeChange,
  onCollabsUpdate,
  onSelectedIdChange
}: CollaborationDetailsProps) {
  const [countdown, setCountdown] = useState<{ submission: CountdownResult; voting: CountdownResult }>({
    submission: { days: 0, hours: 0, minutes: 0, seconds: 0, completed: false },
    voting: { days: 0, hours: 0, minutes: 0, seconds: 0, completed: false }
  });

  useEffect(() => {
    if (mode !== 'view' || !selectedId) return;
    const col = collabs.find(c => c.id === selectedId);
    if (!col || col.status === 'unpublished') return;

      const updateCountdown = () => {
      const subClose = (col as any).submissionCloseAt;
      const votClose = (col as any).votingCloseAt;
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
  }, [mode, selectedId, collabs]);

  if (mode === 'none') {
    return <div style={{ color: 'var(--white)', opacity: 0.8 }}>go on, select something</div>;
  }

  if (mode === 'create' && project) {
    return (
      <CreateCollaboration
        projectId={project.id}
        onCreated={(c) => {
          onCollabsUpdate([c, ...collabs]);
          onSelectedIdChange(c.id);
          onModeChange('view');
        }}
      />
    );
  }

  if (mode === 'view' && selectedId) {
    const col = collabs.find(c => c.id === selectedId);
    if (!col) return <div style={{ color: 'var(--white)' }}>not found</div>;

    const canEdit = col.status === 'unpublished' && collabs.filter(x => (x as any).createdAt < (col as any).createdAt).every(x => x.status === 'completed');
    const hasTimestamps = col.status !== 'unpublished';
    const subCloseAt = (col as any).submissionCloseAt;
    const votCloseAt = (col as any).votingCloseAt;

    return (
      <div style={{ color: 'var(--white)', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontSize: 16, fontWeight: 600 }}>{col.name}</div>
        <div style={{ opacity: 0.85 }}>{col.description}</div>
        <div style={{ opacity: 0.7, fontSize: 12 }}>status: {col.status}</div>

        {hasTimestamps && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8, padding: 12, background: 'rgba(255,255,255,0.05)', borderRadius: 6 }}>
            {/* Phases Container */}
            <div style={{ display: 'flex', gap: 16 }}>
              {/* Submission Phase - Left Half */}
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 4 }}>Submission phase</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <TimerDisplay {...countdown.submission} />
                  <div style={{ fontSize: 11, opacity: 0.6, textAlign: 'center' }}>
                    {subCloseAt ? new Date(toMillis(subCloseAt)).toLocaleString() : 'N/A'}
                  </div>
                </div>
              </div>

              {/* Voting Phase - Right Half */}
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 4 }}>Voting phase</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <TimerDisplay 
                    {...countdown.voting} 
                    pending={col.status === 'submission'} 
                  />
                  <div style={{ fontSize: 11, opacity: 0.6, textAlign: 'center' }}>
                    {votCloseAt ? new Date(toMillis(votCloseAt)).toLocaleString() : 'N/A'}
                  </div>
                </div>
              </div>
            </div>

            {col.status !== 'unpublished' && (
              // <CollabProgressBar progress={40} />
              <CollabProgressBar 
                progress={(() => {
                  const now = Date.now();
                  const publishedAt = toMillis(col.publishedAt);
                  const submissionEnd = toMillis((col as any).submissionCloseAt);
                  const votingEnd = toMillis((col as any).votingCloseAt);

                  console.log('Progress calculation:', {
                    now,
                    publishedAt,
                    submissionEnd,
                    votingEnd,
                    status: col.status
                  });

                  if (col.status === 'voting') {
                    // In voting phase, start at 50% and progress to 100%
                    return 50 + ((now - submissionEnd) / (votingEnd - submissionEnd)) * 50;
                  } else if (col.status === 'completed') {
                    return 100;
                  } else if (col.status === 'submission') {
                    // In submission phase, progress from 0% to 50%
                    return ((now - publishedAt) / (submissionEnd - publishedAt)) * 50;
                  }
                  return 0;
                })()}
              />
            )}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
          <button disabled={!canEdit} onClick={() => onModeChange('edit')}>edit</button>
          <button disabled={col.status !== 'unpublished'} onClick={async () => {
            if (!project) return;
            const now = Date.now();
            const submissionCloseAt = new Date(now + (col.submissionDuration || 0) * 1000);
            const votingCloseAt = new Date(submissionCloseAt.getTime() + (col.votingDuration || 0) * 1000);
            await CollaborationService.updateCollaboration(col.id, {
              status: 'submission',
              publishedAt: new Date() as any,
              submissionCloseAt: submissionCloseAt as any,
              votingCloseAt: votingCloseAt as any
            });
            onCollabsUpdate(collabs.map(x => x.id === col.id ? {
              ...x,
              status: 'submission',
              publishedAt: new Date() as any,
              submissionCloseAt: submissionCloseAt as any,
              votingCloseAt: votingCloseAt as any
            } as any : x));
          }}>publish</button>
          <button disabled={col.status !== 'unpublished'} onClick={async () => {
            const ok = window.confirm('delete this collaboration?');
            if (!ok) return;
            await CollaborationService.deleteCollaboration(col.id);
            onCollabsUpdate(collabs.filter(x => x.id !== col.id));
            onSelectedIdChange(null);
            onModeChange('none');
          }}>delete</button>
          <button disabled={col.status !== 'completed' || !(col as any).winnerPath} onClick={async () => {
            const path = (col as any).winnerPath as string | undefined;
            if (!path) return;
            try {
              const { storage } = await import('../services/firebase');
              const { ref, getBlob } = await import('firebase/storage');
              let filename = path.split('/').pop() || 'winner';
              if (path.startsWith('collabs/')) {
                const storageRef = ref(storage, path);
                const blob = await getBlob(storageRef);
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                a.remove();
                URL.revokeObjectURL(url);
              } else {
                const a = document.createElement('a');
                a.href = path;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                a.remove();
              }
            } catch (e) {
              alert('could not download winner');
            }
          }}>download winner</button>
        </div>
      </div>
    );
  }

  if (mode === 'edit' && selectedId && project) {
    const col = collabs.find(c => c.id === selectedId);
    if (!col) return null;
    if (col.status !== 'unpublished') return <div style={{ color: 'var(--white)' }}>cannot edit published collaboration</div>;

    return (
      <CreateCollaboration
        projectId={project.id}
        mode="edit"
        initial={col}
        onCreated={() => {}}
        onSaved={(updated) => {
          onCollabsUpdate(collabs.map(x => x.id === updated.id ? updated : x));
          onModeChange('view');
        }}
      />
    );
  }

  return null;
}

