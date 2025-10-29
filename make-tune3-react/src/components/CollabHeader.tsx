import type { Collaboration } from '../types/collaboration';
import { CollaborationTimeline } from './CollaborationTimeline';

interface CollabHeaderProps {
  collaboration: Collaboration | null;
  onStageChange?: (nextStatus: 'voting' | 'completed') => void;
}

export function CollabHeader({ collaboration, onStageChange }: CollabHeaderProps) {
  if (!collaboration || collaboration.status === 'unpublished' || collaboration.status === 'completed') {
    return null;
  }

  return (
    <div
      style={{
        backgroundColor: 'var(--primary1-600)',
        padding: '0.5rem',
        borderRadius: '0.5rem',
        boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.2)',
        minWidth: '400px',
        color: 'var(--white)',
        border: '3px solid transparent'
      }}
    >
      <div
        style={{
          backgroundColor: 'var(--primary1-700)',
          padding: '0.75rem',
          borderRadius: '0.25rem',
          boxShadow: 'inset 0 1px 3px rgba(0, 0, 0, 0.1)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem'
        }}
      >
        <CollaborationTimeline
          status={collaboration.status}
          publishedAt={collaboration.publishedAt}
          submissionCloseAt={(collaboration as any).submissionCloseAt}
          votingCloseAt={(collaboration as any).votingCloseAt}
          onStageChange={onStageChange}
        />
      </div>
    </div>
  );
}
