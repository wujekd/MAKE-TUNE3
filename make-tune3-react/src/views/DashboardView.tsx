import { useEffect, useState } from 'react';
import type { Collaboration } from '../types/collaboration';
import { CollaborationService } from '../services';
import { Link } from 'react-router-dom';
import '../components/ProjectHistory.css';
import { MyProjects } from '../components/MyProjects';
import { TagFilter } from '../components/TagFilter';
import { Mixer1Channel } from '../components/Mixer1Channel';
import { useAudioStore } from '../stores';
import { usePlaybackStore } from '../stores/usePlaybackStore';
import { useAppStore } from '../stores/appStore';

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
    <div style={{ background: 'var(--primary1-800)', minHeight: '100%', width: '100%', boxSizing: 'border-box', overflowY: 'auto' }}>
      <div style={dashboardShell}>
        <div
          style={headerCard}
        >
          <div style={headerText}>
            <div style={headerLabel}>dashboard</div>
            <div style={headerTitle}>collab recommendations here</div>
          </div>
          <div style={headerStats}>
            <StatCard value={totalCollabs} label="total collabs" />
            <StatCard value={filteredCount} label="visible" />
            <StatCard value={pendingModeration} label="pending mod" />
          </div>
        </div>

        <div
          style={bodyLayout}
        >
          <div style={sideColumn}>
            <MyProjects />
          </div>

          <div style={mainColumn}>
            <div style={gridRow}>
              <div className="project-history" style={collabsCard}>
                <h4 className="project-history-title">collaborations</h4>
                <div style={filterWrapper}>
                  <TagFilter selectedTags={selectedTags} onTagsChange={handleTagsChange} />
                </div>
                <div
                  className="collab-list"
                  style={{ flex: 1, minHeight: 0, maxHeight: 420, overflowY: 'auto' }}
                  aria-busy={!hasLoaded}
                >
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
                    const isPlaying = isCurrentBacking && !!audioState?.player2.isPlaying;
                    return (
                      <Link key={c.id} to={to} className="collab-history-item list__item">
                        <div className="collab-info" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                            <span className="collab-name list__title">{c.name}</span>
                            <button
                              type="button"
                              onClick={event => {
                                event.preventDefault();
                                event.stopPropagation();
                                if (!hasBacking || !backingPath) return;
                                if (isCurrentBacking) {
                                  if (isPlaying) {
                                    stopBackingPlayback();
                                  } else {
                                    togglePlayPause();
                                  }
                                } else {
                                  playBackingTrack(backingPath, c.name || 'backing');
                                }
                              }}
                              disabled={!hasBacking}
                              style={{ fontSize: 12 }}
                            >
                              {isCurrentBacking ? (isPlaying ? 'pause' : 'resume') : 'play backing'}
                            </button>
                          </div>
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
                      </Link>
                    );
                  })}
                </div>
              </div>
              <div style={mixerColumn}>
                <Mixer1Channel state={audioState} />
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ value, label }: { value: number; label: string }) {
  return (
    <div style={statCard}>
      <div style={statValue}>{value}</div>
      <div style={statLabel}>{label}</div>
    </div>
  );
}

const dashboardShell = {
  maxWidth: 1240,
  margin: '0 auto',
  padding: '18px 20px 24px',
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
  minHeight: '100%',
  boxSizing: 'border-box' as const
};

const headerCard = {
  width: '100%',
  minHeight: 132,
  borderRadius: 12,
  background: 'linear-gradient(135deg, var(--primary1-600), var(--primary1-900))',
  color: 'var(--white)',
  padding: '16px 20px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 24,
  boxShadow: '0 8px 22px rgba(0,0,0,0.28)',
  flexWrap: 'wrap' as const
};

const headerText = { display: 'flex', flexDirection: 'column' as const, gap: 6 };
const headerLabel = { fontSize: 13, opacity: 0.75, textTransform: 'uppercase' as const, letterSpacing: '0.12em' };
const headerTitle = { fontSize: 22, fontWeight: 700 };
const headerSubtitle = { fontSize: 12, opacity: 0.75 };

const headerStats = { display: 'flex', gap: 18, flexWrap: 'wrap' as const, justifyContent: 'flex-end' };
const statCard = { minWidth: 90, textAlign: 'right' as const };
const statValue = { fontSize: 28, fontWeight: 700 };
const statLabel = { fontSize: 11, textTransform: 'uppercase' as const, letterSpacing: '0.08em', opacity: 0.75 };

const bodyLayout = {
  display: 'flex',
  gap: 16,
  flex: 1,
  minHeight: 0,
  flexWrap: 'wrap' as const,
  alignItems: 'stretch' as const
};

const sideColumn = { flex: '1 1 420px', minWidth: 320, maxWidth: 520, display: 'flex', flexDirection: 'column' as const, minHeight: 0 };
const mainColumn = { flex: '1 1 520px', minWidth: 360, display: 'flex', flexDirection: 'column' as const, gap: 16, minHeight: 0 };
const gridRow = { display: 'flex', gap: 16, minHeight: 0, flexWrap: 'wrap' as const };
const collabsCard = { flex: '1 1 420px', minWidth: 300, maxWidth: 'none', display: 'flex', flexDirection: 'column' as const, minHeight: 0 };
const filterWrapper = { padding: '6px 10px 12px' };
const mixerColumn = { flex: '0 0 140px', minWidth: 140, display: 'flex', height: '100%', minHeight: 280 };
