import type { Collaboration } from '../types/collaboration';
import { CollaborationTimeline } from './CollaborationTimeline';

interface CollabHeaderProps {
  collaboration: Collaboration | null;
  onStageChange?: (nextStatus: 'voting' | 'completed') => void;
  displayStatus?: Collaboration['status'];
}

export function CollabHeader({ collaboration, onStageChange, displayStatus }: CollabHeaderProps) {
  if (collaboration && (collaboration.status === 'unpublished' || collaboration.status === 'completed')) {
    return null;
  }

  const isPlaceholder = !collaboration;
  const actualStatus = collaboration?.status ?? displayStatus ?? 'submission';
  const resolvedDisplayStatus = displayStatus ?? collaboration?.status ?? 'submission';

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
          status={actualStatus}
          publishedAt={collaboration?.publishedAt}
          submissionCloseAt={(collaboration as any)?.submissionCloseAt}
          votingCloseAt={(collaboration as any)?.votingCloseAt}
          onStageChange={onStageChange}
          placeholder={isPlaceholder}
          displayStatus={resolvedDisplayStatus}
        />
      </div>
    </div>
  );
}
