import { useCallback, useEffect, useState } from 'react';
import type { Collaboration, Project } from '../types/collaboration';
import { CollaborationService } from '../services';
import { CreateCollaboration } from './CreateCollaboration';
import { CollaborationTimeline } from './CollaborationTimeline';
import { ListPlayButton } from './ListPlayButton';
import { DownloadButton } from './DownloadButton';
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

  const [isPublishing, setIsPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [publishSuccess, setPublishSuccess] = useState(false);

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
    // Reset publish state when selection changes
    setIsPublishing(false);
    setPublishError(null);
    setPublishSuccess(false);

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
    const canEdit = col.status === 'unpublished';
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

        {/* Duration and resource info for unpublished collaborations */}
        {!hasTimestamps && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              marginTop: 8,
              padding: 12,
              background: 'rgba(255,255,255,0.05)',
              borderRadius: 6,
              fontSize: 13
            }}
          >
            <div style={{ opacity: 0.85 }}>
              <strong>submission duration:</strong> {col.submissionDuration ? `${Math.floor(col.submissionDuration / 86400)}d ${Math.floor((col.submissionDuration % 86400) / 3600)}h` : 'not set'}
            </div>
            <div style={{ opacity: 0.85 }}>
              <strong>voting duration:</strong> {col.votingDuration ? `${Math.floor(col.votingDuration / 86400)}d ${Math.floor((col.votingDuration % 86400) / 3600)}h` : 'not set'}
            </div>
            <div style={{ opacity: 0.7, marginTop: 4 }}>
              resources: {[
                col.backingTrackPath ? 'backing ✓' : 'backing ✗',
                col.pdfPath ? 'pdf ✓' : null,
                col.resourcesZipPath ? 'zip ✓' : null
              ].filter(Boolean).join(' • ')}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
          <ListPlayButton
            label="backing"
            isPlaying={!!isPlaying}
            isCurrentTrack={!!isCurrentBacking}
            disabled={!backingPath}
            onPlay={() => {
              if (!backingPath) return;
              if (isCurrentBacking) {
                togglePlayPause();
              } else {
                playBackingTrack(backingPath, col.name || 'backing');
              }
            }}
          />
          <DownloadButton
            label="backing"
            variant="compact"
            disabled={!backingPath}
            onDownload={async () => {
              if (!backingPath) return;
              const { storage } = await import('../services/firebase');
              const { ref, getBlob } = await import('firebase/storage');
              let filename = backingPath.split('/').pop() || 'backing';
              if (backingPath.startsWith('collabs/')) {
                const storageRef = ref(storage, backingPath);
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
                a.href = backingPath;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                a.remove();
              }
            }}
          />
          {col.pdfPath && (
            <DownloadButton
              label="PDF"
              variant="compact"
              onDownload={async () => {
                const path = col.pdfPath!;
                const { storage } = await import('../services/firebase');
                const { ref, getBlob } = await import('firebase/storage');
                const filename = path.split('/').pop() || 'instructions.pdf';
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
              }}
            />
          )}
          {col.resourcesZipPath && (
            <DownloadButton
              label="ZIP"
              variant="compact"
              onDownload={async () => {
                const path = col.resourcesZipPath!;
                const { storage } = await import('../services/firebase');
                const { ref, getBlob } = await import('firebase/storage');
                const filename = path.split('/').pop() || 'resources.zip';
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
              }}
            />
          )}
          <button disabled={!canEdit} onClick={() => onModeChange('edit')}>edit</button>
          <button
            disabled={col.status !== 'unpublished' || isPublishing}
            onClick={async () => {
              if (!project) return;
              setIsPublishing(true);
              setPublishError(null);
              setPublishSuccess(false);

              try {
                await CollaborationService.publishCollaboration(col.id);
                await refreshSelected();
                setPublishSuccess(true);
                setPublishError(null);
              } catch (error: any) {
                console.error('Publish error:', error);

                // Handle specific error cases
                if (error?.code === 'functions/failed-precondition') {
                  setPublishError('Uh no no no, another collaboration is already active.');
                } else {
                  const message = error?.message || 'Something didnt work. Please try again. But if it still doesnt work lmk pls';
                  setPublishError(message);
                }
                setPublishSuccess(false);
              } finally {
                setIsPublishing(false);
              }
            }}
          >
            {isPublishing ? '⟳ publishing...' : 'publish'}
          </button>
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
          <DownloadButton
            label="winner"
            variant="compact"
            disabled={col.status !== 'completed' || !(col as any).winnerPath}
            onDownload={async () => {
              const path = (col as any).winnerPath as string | undefined;
              if (!path) throw new Error('No winner path available');
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
            }}
          />
        </div>

        {/* Publish feedback messages */}
        {publishSuccess && (
          <div style={{
            marginTop: 12,
            padding: 12,
            borderRadius: 6,
            background: 'rgba(34, 197, 94, 0.15)',
            border: '1px solid rgba(34, 197, 94, 0.3)',
            color: 'var(--white)'
          }}>
            ✓ Collaboration published successfully!
          </div>
        )}
        {publishError && (
          <div style={{
            marginTop: 12,
            padding: 12,
            borderRadius: 6,
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            color: 'var(--white)',
            fontSize: 14
          }}>
            {publishError}
          </div>
        )}
      </div>
    );
  }

  if (mode === 'edit' && selectedCollab && project) {
    const handleSaved = (updated: Collaboration) => {
      onCollabsUpdate(collabs.map(col => col.id === updated.id ? updated : col));
      onModeChange('view');
    };

    return (
      <CreateCollaboration
        mode="edit"
        projectId={project.id}
        initial={selectedCollab}
        onCreated={() => {}}
        onSaved={handleSaved}
      />
    );
  }

  return <div style={{ color: 'var(--white)' }}>not found</div>;
}
