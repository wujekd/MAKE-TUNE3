import { useEffect, useState } from 'react';
import type { Collaboration } from '../types/collaboration';
import { CollaborationService } from '../services';
import { Link } from 'react-router-dom';
import '../components/ProjectHistory.css';
import { MyProjects } from '../components/MyProjects';
import { TagFilter } from '../components/TagFilter';
import { Mixer1Channel } from '../components/Mixer1Channel';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ListPlayButton } from '../components/ListPlayButton';
import { useAudioStore } from '../stores';
import { usePlaybackStore } from '../stores/usePlaybackStore';
import { useAppStore } from '../stores/appStore';
import { AudioUrlUtils } from '../utils';
import { usePrefetchAudio } from '../hooks/usePrefetchAudio';
import styles from './DashboardView.module.css';

export function DashboardView() {
  const [allCollabs, setAllCollabs] = useState<Collaboration[]>([]);
  const [filteredCollabs, setFilteredCollabs] = useState<Collaboration[]>([]);
  const [needsMod, setNeedsMod] = useState<Collaboration[]>([]);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [prefetchedUrls, setPrefetchedUrls] = useState<string[]>([]);
  const audioState = useAudioStore(s => s.state);
  const playBackingTrack = usePlaybackStore(s => s.playBackingTrack);
  const stopBackingPlayback = usePlaybackStore(s => s.stopBackingPlayback);
  const backingPreview = usePlaybackStore(s => s.backingPreview);
  const togglePlayPause = useAppStore(s => s.playback.togglePlayPause);

  usePrefetchAudio(prefetchedUrls[0]);
  usePrefetchAudio(prefetchedUrls[1]);
  usePrefetchAudio(prefetchedUrls[2]);
  
  useEffect(() => {
    useAppStore.setState(state => ({
      ...state,
      collaboration: {
        ...state.collaboration,
        currentCollaboration: null,
        currentProject: null
      }
    }));
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        console.log('DashboardView: fetching all collaborations...');
        const list = await CollaborationService.listAllCollaborations();
        console.log('DashboardView: received', list.length, 'collaborations:', list);
        if (mounted) {
          setAllCollabs(list);
          setFilteredCollabs(list);
          setNeedsMod(list.filter(c => (c as any).unmoderatedSubmissions));
        }
      } catch (e: any) {
        console.error('DashboardView: error loading collaborations:', e);
        console.error('DashboardView: error code:', e?.code);
        console.error('DashboardView: error message:', e?.message);
        if (mounted) setError(e?.message || 'failed to load');
      } finally {
        if (mounted) setHasLoaded(true);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (selectedTags.length === 0) {
      setFilteredCollabs(allCollabs);
    } else {
      const filtered = CollaborationService.filterCollaborationsByTags(allCollabs, selectedTags);
      setFilteredCollabs(filtered);
    }
  }, [selectedTags, allCollabs]);

  // Prefetch Firebase URLs for visible collabs (Issue #1: URL Resolution Bottleneck)
  useEffect(() => {
    if (filteredCollabs.length === 0) return;

    let cancelled = false;

    const prefetchUrls = async () => {
      const urls: string[] = [];
      
      // Prefetch first 10 visible collabs with backing tracks
      const collabsToPrefetch = filteredCollabs
        .filter(c => (c as any).backingTrackPath)
        .slice(0, 10);

      if (collabsToPrefetch.length > 0) {
        console.log(`[DashboardView] 🚀 Prefetching Firebase URLs for ${collabsToPrefetch.length} collabs...`);
        const startTime = performance.now();

        for (const collab of collabsToPrefetch) {
          if (cancelled) break;
          const backingPath = (collab as any).backingTrackPath;
          if (backingPath) {
            try {
              // This populates the AudioUrlUtils cache
              const url = await AudioUrlUtils.resolveAudioUrl(backingPath);
              urls.push(url);
            } catch (err) {
              console.warn('[DashboardView] Failed to prefetch URL for:', backingPath, err);
            }
          }
        }

        if (!cancelled) {
          const totalTime = performance.now() - startTime;
          console.log(`[DashboardView] ✅ Prefetched ${urls.length} URLs in ${totalTime.toFixed(0)}ms`);
          setPrefetchedUrls(urls);
        }
      }
    };

    prefetchUrls();

    return () => {
      cancelled = true;
    };
  }, [filteredCollabs]);

  const handleTagsChange = (tagKeys: string[]) => {
    setSelectedTags(tagKeys);
  };

  useEffect(() => {
    return () => {
      stopBackingPlayback();
    };
  }, [stopBackingPlayback]);

  // removed direct navigate wrapper; using <Link to> below

  // always render view; hydrate when data arrives

  const totalCollabs = allCollabs.length;
  const filteredCount = filteredCollabs.length;
  const pendingModeration = needsMod.length;

  return (
    <div className={styles.container}>
      <div className={styles.hero}>
        <div className={styles.heroHeader}>
          <div className={styles.heroIntro}>
            <div className={styles.heroLabel}>dashboard</div>
            <div className={styles.heroDescription}>
              here ill make some kinda collab recommendations based on user and collab tags i think...
            </div>
          </div>
          <div className={styles.stats}>
            <StatCard value={totalCollabs} label="total collabs" />
            <StatCard value={filteredCount} label="visible" />
            <StatCard value={pendingModeration} label="pending mod" />
          </div>
        </div>
      </div>

      <div className={styles.content}>
        <div className={styles.mainSplit}>
          <MyProjects />
          <div className={`project-history ${styles.historyColumn}`}>
            <h4 className="project-history-title">collaborations</h4>
            <div className={styles.historyPanel}>
              <TagFilter selectedTags={selectedTags} onTagsChange={handleTagsChange} />
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

                  return (
                    <Link
                      key={c.id}
                      to={to}
                      className={`collab-history-item list__item ${isCurrentBacking ? 'currently-playing' : ''}`}
                    >
                      {isCurrentBacking && displayProgress > 0 && (
                        <div
                          className="collab-progress-overlay"
                          style={{ width: `${100 - displayProgress}%` }}
                        />
                      )}

                      <div className={`collab-info ${styles.collabInfo}`}>
                        <span className="collab-name list__title">{c.name}</span>
                        <span className="collab-stage list__subtitle">{c.status}</span>
                        {c.tags && c.tags.length > 0 && (
                          <div className={styles.tagRow}>
                            {c.tags.map((tag, i) => (
                              <span key={i} className={styles.tagChip}>
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className={styles.listPlay}>
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
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
        <div className={styles.mixerColumn}>
          <Mixer1Channel state={audioState} />
        </div>
      </div>
    </div>
  );
}

function StatCard({ value, label }: { value: number; label: string }) {
  return (
    <div className={styles.statCard}>
      <div className={styles.statValue}>{value}</div>
      <div className={styles.statLabel}>{label}</div>
    </div>
  );
}
