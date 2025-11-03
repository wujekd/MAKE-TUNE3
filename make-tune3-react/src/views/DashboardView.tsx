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

  // Prefetch audio for first 3 visible items with backing tracks
  const firstCollab = filteredCollabs.find(c => (c as any).backingTrackPath);
  const secondCollab = filteredCollabs.slice(1).find(c => (c as any).backingTrackPath);
  const thirdCollab = filteredCollabs.slice(2).find(c => (c as any).backingTrackPath);
  
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
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12, height: '100%', boxSizing: 'border-box', overflow: 'hidden', background: 'var(--primary1-800)' }}>
      <div style={{
        width: '100%',
        marginTop: 7,
        minHeight: 128,
        borderRadius: 12,
        background: 'linear-gradient(135deg, var(--primary1-600), var(--primary1-900))',
        color: 'var(--white)',
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        flexShrink: 0
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ fontSize: 13, opacity: 0.75, textTransform: 'uppercase', letterSpacing: '0.12em' }}>dashboard</div>
            <div style={{ fontSize: 12, opacity: 0.75 }}>here ill make some kinda collab recommendations based on user and collab tags i think...</div>
          </div>
          <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <StatCard value={totalCollabs} label="total collabs" />
            <StatCard value={filteredCount} label="visible" />
            <StatCard value={pendingModeration} label="pending mod" />
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, flex: 1, minHeight: 0, maxHeight: '100%', overflow: 'hidden' }}>
        <div style={{ display: 'flex', flex: 1, minWidth: 0, gap: 10, minHeight: 0, maxHeight: '100%', overflow: 'hidden' }}>
          {/* <div style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}> */}
            <MyProjects />
          {/* </div> */}
          <div
            className="project-history"
            style={{
              flex: 1,
              minWidth: 0,
              maxWidth: 'none',
              display: 'flex',
              flexDirection: 'column',
              minHeight: 0,
              maxHeight: '100%',
              overflow: 'hidden',
              width: '50%'
            }}
          >
            <h4 className="project-history-title">collaborations</h4>
            <div
              style={{
                padding: 8,
                flex: 1,
                minHeight: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                overflow: 'hidden'
              }}
            >
              <TagFilter selectedTags={selectedTags} onTagsChange={handleTagsChange} />
              <div
                className="collab-list"
                style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}
                aria-busy={!hasLoaded}
              >
                  {!hasLoaded && !error && (
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '2rem' }}>
                      <LoadingSpinner size={24} />
                    </div>
                  )}
                  {error && <div style={{ color: 'var(--white)' }}>{error}</div>}
                  {hasLoaded && !error && filteredCollabs.length === 0 && (
                    <div style={{ color: 'var(--white)' }}>
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
                    
                    // Calculate progress for the overlay
                    const displayProgress = isCurrentBacking && audioState?.player2.duration && audioState.player2.duration > 0
                      ? ((audioState?.player2.currentTime ?? 0) / audioState.player2.duration) * 100
                      : 0;
                    
                    return (
                      <Link 
                        key={c.id} 
                        to={to} 
                        className={`collab-history-item list__item ${isCurrentBacking ? 'currently-playing' : ''}`}
                      >
                        {/* Progress overlay - shrinks from right to left revealing background */}
                        {isCurrentBacking && displayProgress > 0 && (
                          <div 
                            className="collab-progress-overlay" 
                            style={{ width: `${100 - displayProgress}%` }}
                          />
                        )}
                        
                        <div className="collab-info" style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minWidth: 0 }}>
                          <span className="collab-name list__title">{c.name}</span>
                          <span className="collab-stage list__subtitle">{c.status}</span>
                          {c.tags && c.tags.length > 0 && (
                            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                              {c.tags.map((tag, i) => (
                                <span
                                  key={i}
                                  style={{
                                    fontSize: 11,
                                    background: 'var(--primary1-600)',
                                    padding: '2px 8px',
                                    borderRadius: 8,
                                    opacity: 0.8,
                                  }}
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', paddingLeft: '12px' }}>
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
        <div style={{ width: 140, flexShrink: 0, display: 'flex', flexDirection: 'column', minHeight: 0, maxHeight: '100%', overflow: 'hidden' }}>
          <Mixer1Channel state={audioState} />
        </div>
      </div>
    </div>
  );
}

function StatCard({ value, label }: { value: number; label: string }) {
  return (
    <div style={{ minWidth: 90, textAlign: 'right' as const }}>
      <div style={{ fontSize: 28, fontWeight: 700 }}>{value}</div>
      <div style={{ fontSize: 11, textTransform: 'uppercase' as const, letterSpacing: '0.08em', opacity: 0.75 }}>{label}</div>
    </div>
  );
}
