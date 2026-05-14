import type { Collaboration } from '../types/collaboration';
import { TagFilter } from './TagFilter';
import { ListPlayButton } from './ListPlayButton';
import { CollabListItem } from './CollabListItem';
import { DashboardPlaceholderItem } from './DashboardPlaceholderItem';
import { BackingWaveformPreview } from './BackingWaveformPreview';
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
  availableTags: Array<{ key: string; name: string; count: number }>;
}

export function CollaborationsPanel({
  filteredCollabs,
  hasLoaded,
  error,
  selectedTags,
  onTagsChange,
  availableTags
}: CollaborationsPanelProps) {
  const audioState = useAudioStore(s => s.state);
  const playBackingTrack = usePlaybackStore(s => s.playBackingTrack);
  const backingPreview = usePlaybackStore(s => s.backingPreview);
  const togglePlayPause = useAppStore(s => s.playback.togglePlayPause);
  const loadingPlaceholders = [0, 1, 2];

  return (
    <div className={`project-history ${styles.historyColumn}`}>
      <h4 className="project-history-title">collaborations</h4>
      <div className={styles.historyPanel}>
        <TagFilter
          selectedTags={selectedTags}
          onTagsChange={onTagsChange}
          variant="slim"
          tags={availableTags}
          loading={!hasLoaded}
        />
        <div className={`collab-list ${styles.collabList}`} aria-busy={!hasLoaded}>
          {!hasLoaded && !error && (
            <div className={`${styles.placeholderList} dashboard-placeholder-stack`}>
              {loadingPlaceholders.map(index => (
                <DashboardPlaceholderItem key={index} variant="collaboration" metaLineCount={0} />
              ))}
            </div>
          )}
          {hasLoaded && error && (
            <div className={`${styles.emptyState} ${styles.errorState}`} role="status">
              <div className={styles.emptyStateTitle}>Could not load collaborations</div>
              <div className={styles.emptyStateBody}>
                {error || 'Please try again in a moment.'}
              </div>
            </div>
          )}
          {hasLoaded && !error && filteredCollabs.length === 0 && (
            <div className={styles.emptyState}>
              <div className={styles.emptyStateTitle}>
                {selectedTags.length > 0 ? 'No matches for these tags' : 'No collaborations yet'}
              </div>
              <div className={styles.emptyStateBody}>
                {selectedTags.length > 0
                  ? 'No displayable collaborations are currently published for the selected tags.'
                  : 'Published collaborations will appear here.'}
              </div>
            </div>
          )}
          {filteredCollabs.map((c, collabIndex) => {
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
            const backingCurrentTime = isCurrentBacking ? (audioState?.player2.currentTime ?? 0) : 0;
            const backingDuration = isCurrentBacking ? (audioState?.player2.duration ?? 0) : 0;
            const isBackingPlaying = isCurrentBacking ? Boolean(audioState?.player2.isPlaying) : false;

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
                footerSlot={hasBacking ? (
                  <BackingWaveformPreview
                    collaboration={c}
                    isActive={isCurrentBacking}
                    progress={displayProgress / 100}
                    currentTime={backingCurrentTime}
                    duration={backingDuration}
                    isPlaying={isBackingPlaying}
                    animationDelayMs={Math.min(collabIndex, 12) * 160}
                  />
                ) : undefined}
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
                footerMetaSlot={c.tags && c.tags.length > 0 ? (
                  <div className={styles.tagRow}>
                    {c.tags.map((tag, i) => (
                      <span key={i} className={styles.tagChip}>
                        {tag}
                      </span>
                    ))}
                  </div>
                ) : undefined}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
