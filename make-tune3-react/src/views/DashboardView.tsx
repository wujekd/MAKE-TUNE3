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
import { usePrefetchAudio } from '../hooks/usePrefetchAudio';
import { CollabListItem } from '../components/CollabListItem';
import { useCollabBackingsPrefetch } from '../hooks/useCollabBackingsPrefetch';
import styles from './DashboardView.module.css';

export function DashboardView() {
  const [allCollabs, setAllCollabs] = useState<Collaboration[]>([]);
  const [filteredCollabs, setFilteredCollabs] = useState<Collaboration[]>([]);
  const [needsMod, setNeedsMod] = useState<Collaboration[]>([]);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const audioState = useAudioStore(s => s.state);
  const playBackingTrack = usePlaybackStore(s => s.playBackingTrack);
  const stopBackingPlayback = usePlaybackStore(s => s.stopBackingPlayback);
  const backingPreview = usePlaybackStore(s => s.backingPreview);
  const togglePlayPause = useAppStore(s => s.playback.togglePlayPause);

  const prefetchedUrls = useCollabBackingsPrefetch(filteredCollabs);
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
                    <CollabListItem
                      key={c.id}
                      to={to}
                      title={c.name}
                      subtitle={c.status}
                      isActive={isCurrentBacking}
                      progressPercent={isCurrentBacking ? displayProgress : undefined}
                      listVariant
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
