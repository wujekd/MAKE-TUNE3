import type { DashboardFeedItem, DashboardFeedMode } from '../services/dashboardFeedService';
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

interface DashboardCollabsPanelProps {
  items: DashboardFeedItem[];
  hasLoaded: boolean;
  error: string | null;
  selectedTags: string[];
  onTagsChange: (tagKeys: string[]) => void;
  availableTags: Array<{ key: string; name: string; count: number }>;
  feedMode: DashboardFeedMode;
  onFeedModeChange: (mode: DashboardFeedMode) => void;
  metaLabel: string;
}

const getTrackLabel = (path: string | null): string | null => {
  if (!path) return null;
  const fileName = path.split('/').filter(Boolean).pop() || path;
  return `highlight ${fileName}`;
};

const getCollaborationRoute = (item: DashboardFeedItem): string => {
  const encodedId = encodeURIComponent(item.collaborationId);
  if (item.collaborationStatus === 'submission') {
    return `/collab/${encodedId}/submit`;
  }
  if (item.collaborationStatus === 'completed') {
    return `/collab/${encodedId}/completed`;
  }
  return `/collab/${encodedId}`;
};

const getStageDetail = (status: string, label?: string | null): string => {
  const trimmedLabel = (label || '').trim();
  if (!trimmedLabel) return '';
  const normalizedStatus = status.trim().toLowerCase();
  if (!normalizedStatus) return trimmedLabel;
  const escapedStatus = normalizedStatus.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return trimmedLabel.replace(new RegExp(`^${escapedStatus}\\s+`, 'i'), '').trim();
};

const loadingPlaceholders = [0, 1, 2];
const feedOptions: Array<{ mode: DashboardFeedMode; label: string }> = [
  { mode: 'recommended', label: 'recommended' },
  { mode: 'newest', label: 'newest' },
  { mode: 'popular', label: 'popular' },
  { mode: 'ending_soon', label: 'ending soon' }
];

export function DashboardCollabsPanel({
  items,
  hasLoaded,
  error,
  selectedTags,
  onTagsChange,
  availableTags,
  feedMode,
  onFeedModeChange,
  metaLabel: _metaLabel
}: DashboardCollabsPanelProps) {
  const audioState = useAudioStore(s => s.state);
  const playBackingTrack = usePlaybackStore(s => s.playBackingTrack);
  const backingPreview = usePlaybackStore(s => s.backingPreview);
  const togglePlayPause = useAppStore(s => s.playback.togglePlayPause);
  const feedSummary = selectedTags.length > 0
    ? `${selectedTags.length} tag${selectedTags.length === 1 ? '' : 's'} selected`
    : 'All tags selected';
  const loadedSummary = hasLoaded
    ? `${items.length} collaboration${items.length === 1 ? '' : 's'} loaded`
    : 'Loading collaborations';

  return (
    <>
      <aside className={styles.controlColumn} aria-label="Explore controls">
        <h4 className={styles.panelTitle}>Explore controls</h4>
        <div className={styles.controlStack}>
          <div className={styles.controlGroup}>
            <div className={styles.controlLabel}>Tags</div>
            <TagFilter
              selectedTags={selectedTags}
              onTagsChange={onTagsChange}
              variant="slim"
              tags={availableTags}
              loading={!hasLoaded && availableTags.length === 0}
              showHeader={false}
              searchable
            />
          </div>

          <div className={styles.controlGroup}>
            <div className={styles.controlLabel}>Sort</div>
            <div className={styles.feedOptions} aria-label="Collaboration feed options">
              {feedOptions.map(option => (
                <button
                  key={option.mode}
                  type="button"
                  className={`${styles.feedOption} ${feedMode === option.mode ? styles.feedOptionActive : ''}`}
                  onClick={() => onFeedModeChange(option.mode)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.controlGroup}>
            <div className={styles.controlLabel}>Feed status</div>
            <div className={styles.filterSummary} role="status">
              <strong>{loadedSummary}</strong>
              <span>{feedSummary}</span>
            </div>
          </div>
        </div>
      </aside>

      <div id="collaboration-feed" className={`project-history ${styles.historyColumn}`}>
        <div className={styles.feedHeader}>
          <h4 className="project-history-title">Explore feed</h4>
        </div>

        <div className={styles.historyPanel}>
          <div className={`collab-list ${styles.collabList}`} aria-busy={!hasLoaded}>
            {!hasLoaded && !error && (
              <div className={`${styles.placeholderList} dashboard-placeholder-stack`}>
                {loadingPlaceholders.map(index => (
                  <DashboardPlaceholderItem key={index} variant="collaboration" />
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
            {hasLoaded && !error && items.length === 0 && (
              <div className={styles.emptyState}>
                <div className={styles.emptyStateTitle}>
                  {selectedTags.length > 0 ? 'No matches for these tags' : 'No collaborations yet'}
                </div>
                <div className={styles.emptyStateBody}>
                  {selectedTags.length > 0
                    ? 'No displayable collaborations are currently published for the selected tags.'
                    : 'New collaborations will appear here when they are published.'}
                </div>
              </div>
            )}
            {items.map((item, itemIndex) => {
              const hasBacking = Boolean(item.backingTrackPath);
              const backingPath = item.backingTrackPath || undefined;
              const isCurrentBacking = hasBacking && backingPreview?.path === backingPath;
              const displayProgress = isCurrentBacking && audioState?.player2.duration && audioState.player2.duration > 0
                ? ((audioState?.player2.currentTime ?? 0) / audioState.player2.duration) * 100
                : 0;
              const backingCurrentTime = isCurrentBacking ? (audioState?.player2.currentTime ?? 0) : 0;
              const backingDuration = isCurrentBacking ? (audioState?.player2.duration ?? 0) : 0;
              const isBackingPlaying = isCurrentBacking ? Boolean(audioState?.player2.isPlaying) : false;

              const rawStageInfo = computeStageInfo({
                status: item.collaborationStatus,
                submissionCloseAt: item.submissionCloseAt,
                votingCloseAt: item.votingCloseAt,
                submissionDurationMs:
                  typeof item.submissionDurationSeconds === 'number'
                    ? item.submissionDurationSeconds * 1000
                    : null,
                votingDurationMs:
                  typeof item.votingDurationSeconds === 'number'
                    ? item.votingDurationSeconds * 1000
                    : null,
                publishedAt: item.publishedAt,
                updatedAt: item.updatedAt
              });
              const stageInfo = rawStageInfo
                ? {
                    status: rawStageInfo.status,
                    startAt: rawStageInfo.startAt ?? null,
                    endAt: rawStageInfo.endAt ?? null,
                    label: rawStageInfo.label ?? undefined
                  }
                : null;
              const trackLabel = getTrackLabel(item.highlightedTrackPath);
              const stageDetail = getStageDetail(stageInfo?.status || item.collaborationStatus, stageInfo?.label);

              return (
                <CollabListItem
                  key={`${item.collaborationId}-${item.source}`}
                  to={getCollaborationRoute(item)}
                  title={(
                    <span className={styles.feedTitleLine}>
                      <span className={styles.feedCollabName}>
                        {item.collaborationName || 'untitled collaboration'}
                      </span>
                      {item.projectName && (
                        <span className={styles.feedProjectInline}>{item.projectName}</span>
                      )}
                    </span>
                  )}
                  subtitle={item.collaborationStatus}
                  isActive={isCurrentBacking}
                  progressPercent={isCurrentBacking ? displayProgress : undefined}
                  listVariant
                  stageInfo={stageInfo}
                  footerSlot={hasBacking ? (
                    <BackingWaveformPreview
                      collaboration={{
                        id: item.collaborationId,
                        name: item.collaborationName,
                        backingTrackPath: item.backingTrackPath,
                        backingWaveformPath: item.backingWaveformPath,
                        backingWaveformStatus: item.backingWaveformStatus,
                        backingWaveformBucketCount: item.backingWaveformBucketCount,
                        backingWaveformVersion: item.backingWaveformVersion,
                        backingWaveformPreview: item.backingWaveformPreview
                      } as any}
                      isActive={isCurrentBacking}
                      progress={displayProgress / 100}
                      currentTime={backingCurrentTime}
                      duration={backingDuration}
                      isPlaying={isBackingPlaying}
                      animationDelayMs={Math.min(itemIndex, 12) * 160}
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
                          playBackingTrack(backingPath, item.collaborationName || 'backing');
                        }
                      }}
                    />
                  }
                  footerMetaSlot={item.collaborationTags.length > 0 ? (
                    <div className={styles.tagRow}>
                      {item.collaborationTags.map((tag, index) => (
                        <span key={`${item.collaborationId}-${tag}-${index}`} className={styles.tagChip}>
                          {tag}
                        </span>
                      ))}
                    </div>
                  ) : undefined}
                >
                  {(stageDetail || item.rank || item.collaborationDescription || trackLabel) && (
                    <div className={styles.feedItemMetaBlock}>
                      <div className={styles.feedMetaRow}>
                        {trackLabel && (
                          <span className={styles.feedPill}>{trackLabel}</span>
                        )}
                        {!trackLabel && item.collaborationDescription && (
                          <span className={styles.feedDescription}>{item.collaborationDescription}</span>
                        )}
                        {stageDetail && (
                          <span className={styles.feedStageDetail}>{stageDetail}</span>
                        )}
                      </div>
                    </div>
                  )}
                </CollabListItem>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
