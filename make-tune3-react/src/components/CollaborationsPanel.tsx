import type { Collaboration } from '../types/collaboration';
import { TagFilter } from './TagFilter';
import { LoadingSpinner } from './LoadingSpinner';
import { ListPlayButton } from './ListPlayButton';
import { CollabListItem } from './CollabListItem';
import { useAudioStore } from '../stores';
import { usePlaybackStore } from '../stores/usePlaybackStore';
import { useAppStore } from '../stores/appStore';
import { computeStageInfo } from '../utils/stageUtils';
import styles from '../views/DashboardView.module.css';

interface CollaborationsPanelProps {
  filteredCollabs: Collaboration[];
  hasLoaded: boolean;
  error: string | null;
  selectedTags: string[];
  onTagsChange: (tagKeys: string[]) => void;
}

export function CollaborationsPanel({
  filteredCollabs,
  hasLoaded,
  error,
  selectedTags,
  onTagsChange
}: CollaborationsPanelProps) {
  const audioState = useAudioStore(s => s.state);
  const playBackingTrack = usePlaybackStore(s => s.playBackingTrack);
  const backingPreview = usePlaybackStore(s => s.backingPreview);
  const togglePlayPause = useAppStore(s => s.playback.togglePlayPause);

  return (
    <div className={`project-history ${styles.historyColumn}`}>
      <h4 className="project-history-title">collaborations</h4>
      <div className={styles.historyPanel}>
        <TagFilter selectedTags={selectedTags} onTagsChange={onTagsChange} />
        <div className={`collab-list ${styles.collabList}`} aria-busy={!hasLoaded}>
          {!hasLoaded && !error && (
            <div className={styles.spinnerContainer}>
              <LoadingSpinner size={24} />
            </div>
          )}
          {error && <div className={styles.emptyState}>{error}</div>}
          {hasLoaded && !error && filteredCollabs.length === 0 && (
            <div className={styles.emptyState}>
              {selectedTags.length > 0 ? 'no collaborations with selected tags' : 'no collaborations'}
            </div>
          )}
          {filteredCollabs.map(c => {
            const s = String(c.status || '').toLowerCase().trim();
            const id = encodeURIComponent(c.id);
            const to =
              s === 'submission' ? `/collab/${id}/submit` : s === 'completed' ? `/collab/${id}/completed` : `/collab/${id}`;
            const hasBacking = Boolean((c as any).backingTrackPath);
            const backingPath = (c as any).backingTrackPath as string | undefined;
            const isCurrentBacking = hasBacking && backingPreview?.path === backingPath;

            const displayProgress = isCurrentBacking && audioState?.player2.duration && audioState.player2.duration > 0
              ? ((audioState?.player2.currentTime ?? 0) / audioState.player2.duration) * 100
              : 0;

            const rawStageInfo = computeStageInfo({
              status: c.status,
              submissionCloseAt: (c as any).submissionCloseAt,
              votingCloseAt: (c as any).votingCloseAt,
              submissionDurationMs: typeof c.submissionDuration === 'number' ? c.submissionDuration * 1000 : null,
              votingDurationMs: typeof c.votingDuration === 'number' ? c.votingDuration * 1000 : null,
              publishedAt: (c as any).publishedAt,
              updatedAt: (c as any).updatedAt
            });
            const stageInfo = rawStageInfo
              ? {
                  status: rawStageInfo.status,
                  startAt: rawStageInfo.startAt ?? null,
                  endAt: rawStageInfo.endAt ?? null,
                  label: rawStageInfo.label ?? undefined
                }
              : null;

            return (
              <CollabListItem
                key={c.id}
                to={to}
                title={c.name}
                subtitle={c.status}
                isActive={isCurrentBacking}
                progressPercent={isCurrentBacking ? displayProgress : undefined}
                listVariant
                stageInfo={stageInfo}
                rightSlot={
                  <ListPlayButton
                    isPlaying={audioState?.player2.isPlaying || false}
                    isCurrentTrack={isCurrentBacking}
                    disabled={!hasBacking}
                    onPlay={() => {
                      if (!hasBacking || !backingPath) return;
                      if (isCurrentBacking) {
                        togglePlayPause();
                      } else {
                        playBackingTrack(backingPath, c.name || 'backing');
                      }
                    }}
                  />
                }
              >
                {c.tags && c.tags.length > 0 && (
                  <div className={styles.tagRow}>
                    {c.tags.map((tag, i) => (
                      <span key={i} className={styles.tagChip}>
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </CollabListItem>
            );
          })}
        </div>
      </div>
    </div>
  );
}
