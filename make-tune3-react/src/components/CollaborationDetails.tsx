import { useCallback, useEffect } from 'react';
import type { Collaboration, Project } from '../types/collaboration';
import { CollaborationService } from '../services';
import { CreateCollaboration } from './CreateCollaboration';
import { CollaborationTimeline } from './CollaborationTimeline';
import { usePlaybackStore } from '../stores/usePlaybackStore';
import { useAudioStore, useAppStore } from '../stores';

interface CollaborationDetailsProps {
  mode: 'none' | 'create' | 'view' | 'edit';
  selectedId: string | null;
  collabs: Collaboration[];
  project: Project | null;
  onModeChange: (mode: 'none' | 'create' | 'view' | 'edit') => void;
  onCollabsUpdate: (collabs: Collaboration[]) => void;
  onSelectedIdChange: (id: string | null) => void;
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
  const selectedCollab = selectedId ? collabs.find(c => c.id === selectedId) ?? null : null;
  const playBackingTrack = usePlaybackStore(s => s.playBackingTrack);
  const stopBackingPlayback = usePlaybackStore(s => s.stopBackingPlayback);
  const backingPreview = usePlaybackStore(s => s.backingPreview);
  const audioState = useAudioStore(s => s.state);
  const togglePlayPause = useAppStore(s => s.playback.togglePlayPause);

  const refreshSelected = useCallback(async () => {
    if (!selectedId) return;
    try {
      const updated = await CollaborationService.getCollaboration(selectedId);
      if (!updated) return;
      const merged = collabs.map(col => (col.id === selectedId ? { ...col, ...updated } : col));
      onCollabsUpdate(merged);
    } catch {
      // ignore refresh failures for now
    }
  }, [selectedId, collabs, onCollabsUpdate]);

  useEffect(() => {
    return () => {
      stopBackingPlayback();
    };
  }, [selectedId, stopBackingPlayback]);

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

  if (mode === 'view' && selectedCollab) {
    const col = selectedCollab;
    const canEdit = col.status === 'unpublished' && collabs.filter(x => (x as any).createdAt < (col as any).createdAt).every(x => x.status === 'completed');
    const hasTimestamps = col.status !== 'unpublished';
    const backingPath = col.backingTrackPath || '';
    const isCurrentBacking = backingPath && backingPreview?.path === backingPath;
    const isPlaying = isCurrentBacking && !!audioState?.player2.isPlaying;

    return (
      <div style={{ color: 'var(--white)', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontSize: 16, fontWeight: 600 }}>{col.name}</div>
        <div style={{ opacity: 0.85 }}>{col.description}</div>
        <div style={{ opacity: 0.7, fontSize: 12 }}>status: {col.status}</div>

        {hasTimestamps && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              marginTop: 8,
              padding: 12,
              background: 'rgba(255,255,255,0.05)',
              borderRadius: 6
            }}
          >
            <CollaborationTimeline
              status={col.status}
              publishedAt={col.publishedAt}
              submissionCloseAt={(col as any).submissionCloseAt}
              votingCloseAt={(col as any).votingCloseAt}
              onStageChange={() => refreshSelected()}
            />
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
          <button
            disabled={!backingPath}
            onClick={() => {
              if (!backingPath) return;
              if (isCurrentBacking) {
                if (isPlaying) {
                  stopBackingPlayback();
                } else {
                  togglePlayPause();
                }
              } else {
                playBackingTrack(backingPath, col.name || 'backing');
              }
            }}
          >
            {isCurrentBacking
              ? (isPlaying ? 'pause backing' : 'resume backing')
              : 'play backing'}
          </button>
          <button disabled={!canEdit} onClick={() => onModeChange('edit')}>edit</button>
          <button
            disabled={col.status !== 'unpublished'}
            onClick={async () => {
              if (!project) return;
              try {
                await CollaborationService.publishCollaboration(col.id);
                await refreshSelected();
              } catch (error: any) {
                const message = error?.message || error?.code ? `${error.code}: ${error.message}` : 'failed to publish collaboration';
                window.alert(message);
              }
            }}
          >publish</button>
          <button
            disabled={col.status !== 'unpublished'}
            onClick={async () => {
              const ok = window.confirm('delete this collaboration?');
              if (!ok) return;
              await CollaborationService.deleteCollaboration(col.id);
              onCollabsUpdate(collabs.filter(x => x.id !== col.id));
              onSelectedIdChange(null);
              onModeChange('none');
            }}
          >
            delete
          </button>
          <button
            disabled={col.status !== 'completed' || !(col as any).winnerPath}
            onClick={async () => {
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
            }}
          >
            download winner
          </button>
        </div>
      </div>
    );
  }

  if (mode === 'edit' && selectedCollab && project) {
    return (
      <CreateCollaboration
        mode="edit"
        projectId={project.id}
        initial={selectedCollab}
        onCreated={(updated) => {
          onCollabsUpdate(collabs.map(col => col.id === updated.id ? updated : col));
          onModeChange('view');
        }}
      />
    );
  }

  return <div style={{ color: 'var(--white)' }}>not found</div>;
}
