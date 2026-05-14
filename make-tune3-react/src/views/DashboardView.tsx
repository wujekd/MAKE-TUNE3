import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { DashboardService } from '../services/dashboardService';
import { DashboardFeedService } from '../services/dashboardFeedService';
import type { DashboardFeedItem, DashboardFeedMode } from '../services/dashboardFeedService';
import { TagService } from '../services/tagService';
import { UserActivityPanel } from '../components/UserActivityPanel';
import { DashboardHeader } from '../components/DashboardHeader';
import type { DashboardWorkbench } from '../components/DashboardHeader';
import { DashboardCollabsPanel } from '../components/DashboardCollabsPanel';
import { AudioRouteBoundary } from '../components/AudioRouteBoundary';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { useAudioStore } from '../stores';
import { usePlaybackStore } from '../stores/usePlaybackStore';
import { useAppStore } from '../stores/appStore';
import { usePrefetchAudio } from '../hooks/usePrefetchAudio';
import { useCollabBackingsPrefetch } from '../hooks/useCollabBackingsPrefetch';
import styles from './DashboardView.module.css';

const Mixer1Channel = lazy(() =>
  import('../components/Mixer1Channel').then(module => ({ default: module.Mixer1Channel }))
);

function MixerPlaceholder() {
  return (
    <div className={styles.mixerPlaceholder} aria-hidden="true">
      <LoadingSpinner size={28} />
    </div>
  );
}

export function DashboardView() {
  const [items, setItems] = useState<DashboardFeedItem[]>([]);
  const [hasLoaded, setHasLoaded] = useState(false);
  const hasLoadedFeedRef = useRef(false);
  const [activeWorkbench, setActiveWorkbench] = useState<DashboardWorkbench>('explore');
  const [projectWorkbenchMode, setProjectWorkbenchMode] = useState<'projects' | 'activity'>('projects');
  const [createProjectRequestKey, setCreateProjectRequestKey] = useState(0);
  const [projectsPanelRequestKey, setProjectsPanelRequestKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [availableTags, setAvailableTags] = useState<Array<{ key: string; name: string; count: number }>>([]);
  const [feedMode, setFeedMode] = useState<DashboardFeedMode>('recommended');
  const [feedMetaLabel, setFeedMetaLabel] = useState('');
  const [stats, setStats] = useState({
    totalCollabs: 0,
    totalSubmissions: 0,
    totalVotes: 0,
    activeCollabs: 0
  });
  const audioState = useAudioStore(s => s.state);
  const isAudioReady = useAudioStore(s => Boolean(s.engine && s.state));
  const authLoading = useAppStore(state => state.auth.loading);
  const user = useAppStore(state => state.auth.user);
  const userId = useAppStore(state => state.auth.user?.uid);
  const stopBackingPlayback = usePlaybackStore(s => s.stopBackingPlayback);

  const [prefetchEnabled, setPrefetchEnabled] = useState(false);

  const connection = typeof navigator !== 'undefined'
    ? (navigator as Navigator & {
        connection?: { effectiveType?: string; saveData?: boolean };
      }).connection
    : undefined;
  const effectiveType = connection?.effectiveType ?? '';
  const saveData = connection?.saveData === true;
  const prefetchLimit = saveData ? 0 : effectiveType === '3g' ? 1 : 3;

  useEffect(() => {
    if (!hasLoaded || authLoading || !isAudioReady || prefetchLimit <= 0) {
      setPrefetchEnabled(false);
      return;
    }

    let cancelled = false;
    const enablePrefetch = () => {
      if (!cancelled) {
        setPrefetchEnabled(true);
      }
    };

    const timeoutId = window.setTimeout(enablePrefetch, effectiveType === '4g' ? 1200 : 2000);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [authLoading, effectiveType, hasLoaded, isAudioReady, prefetchLimit]);

  const prefetchedUrls = useCollabBackingsPrefetch(items, prefetchLimit, prefetchEnabled);
  usePrefetchAudio(prefetchedUrls[0], { enabled: prefetchEnabled });
  usePrefetchAudio(prefetchedUrls[1], { enabled: prefetchEnabled });
  usePrefetchAudio(prefetchedUrls[2], { enabled: prefetchEnabled });

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
        const [tagRows, dashboardStats] = await Promise.all([
          TagService.getActiveCollaborationTags(),
          DashboardService.getDashboardStats()
        ]);
        if (mounted) {
          setAvailableTags(tagRows.map(tag => ({
            key: tag.key,
            name: tag.name,
            count: tag.collaborationCount || 0
          })));
          setStats(dashboardStats);
        }
      } catch {
        if (mounted) {
          setAvailableTags([]);
        }
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (authLoading) {
      return;
    }

    let mounted = true;
    if (!hasLoadedFeedRef.current) {
      setHasLoaded(false);
    }
    setError(null);

    (async () => {
      try {
        const feed = await DashboardFeedService.loadFeed({
          mode: feedMode,
          selectedTags
        });
        if (!mounted) return;
        setItems(feed.items);
        setFeedMetaLabel(feed.metaLabel);
      } catch (e: any) {
        if (!mounted) return;
        setItems([]);
        setFeedMetaLabel('');
        setError(e?.message || 'Unable to load collaborations right now.');
      } finally {
        if (mounted) {
          hasLoadedFeedRef.current = true;
          setHasLoaded(true);
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, [authLoading, feedMode, selectedTags, userId]);

  useEffect(() => {
    return () => {
      stopBackingPlayback();
    };
  }, [stopBackingPlayback]);

  // removed direct navigate wrapper; using <Link to> below

  // always render view; hydrate when data arrives
  const handleCreateProjectRequest = () => {
    setActiveWorkbench('projects');
    setProjectWorkbenchMode('projects');
    setCreateProjectRequestKey(key => key + 1);
  };

  const handleOpenProjectsRequest = () => {
    setActiveWorkbench('projects');
    setProjectWorkbenchMode('projects');
    setProjectsPanelRequestKey(key => key + 1);
  };

  const handleOpenActivityRequest = () => {
    setActiveWorkbench('projects');
    setProjectWorkbenchMode('activity');
  };

  const feedModeLabel = feedMode.replace('_', ' ');

  return (
    <div className={`view-container ${styles.container}`}>
      <DashboardHeader
        totalCollabs={stats.totalCollabs}
        totalSubmissions={stats.totalSubmissions}
        totalVotes={stats.totalVotes}
        activeCollabs={stats.activeCollabs}
        activeWorkbench={activeWorkbench}
        selectedTagCount={selectedTags.length}
        feedModeLabel={feedModeLabel}
        onWorkbenchChange={setActiveWorkbench}
        onCreateProjectRequest={handleCreateProjectRequest}
        onOpenProjectsRequest={handleOpenProjectsRequest}
      />

      <div className={styles.content}>
        <div className={styles.mainSplit}>
          {activeWorkbench === 'explore' && (
            <DashboardCollabsPanel
              items={items}
              hasLoaded={hasLoaded}
              error={error}
              selectedTags={selectedTags}
              onTagsChange={setSelectedTags}
              availableTags={availableTags}
              feedMode={feedMode}
              onFeedModeChange={setFeedMode}
              metaLabel={feedMetaLabel}
            />
          )}

          {activeWorkbench === 'projects' && (
            <>
              <aside className={styles.controlColumn} aria-label="Project controls">
                <h4 className={styles.panelTitle}>Project controls</h4>
                <div className={styles.controlStack}>
                  <div className={styles.controlGroup}>
                    <div className={styles.controlLabel}>Mode</div>
                    <button
                      type="button"
                      className={`${styles.workbenchToggle} ${projectWorkbenchMode === 'projects' ? styles.workbenchToggleActive : ''}`}
                      onClick={handleOpenProjectsRequest}
                    >
                      My projects
                    </button>
                    <button
                      type="button"
                      className={`${styles.workbenchToggle} ${projectWorkbenchMode === 'activity' ? styles.workbenchToggleActive : ''}`}
                      onClick={handleOpenActivityRequest}
                    >
                      My activity
                    </button>
                    <button
                      type="button"
                      className={styles.workbenchToggle}
                      onClick={() => setActiveWorkbench('account')}
                    >
                      Account
                    </button>
                    <button
                      type="button"
                      className={styles.workbenchToggle}
                      onClick={() => setActiveWorkbench('explore')}
                    >
                      Explore feed
                    </button>
                  </div>
                  <div className={styles.controlGroup}>
                    <div className={styles.controlLabel}>Quick action</div>
                    <button
                      type="button"
                      className={styles.workbenchPrimary}
                      onClick={handleCreateProjectRequest}
                    >
                      Create project
                    </button>
                  </div>
                  <div className={styles.filterSummary}>
                    <strong>{user ? 'Project workbench' : 'Login required'}</strong>
                    <span>{user ? 'Your project list and creation form stay in the center bay.' : 'Sign in to create or manage projects.'}</span>
                  </div>
                </div>
              </aside>
              <div className={`project-history ${styles.historyColumn}`}>
                <UserActivityPanel
                  createProjectRequestKey={createProjectRequestKey}
                  projectsPanelRequestKey={projectsPanelRequestKey}
                  activeTabOverride={projectWorkbenchMode}
                  hideTabs
                />
              </div>
            </>
          )}

          {activeWorkbench === 'account' && (
            <AccountWorkbench
              userName={user?.username || user?.email || 'Guest'}
              isSignedIn={Boolean(user)}
              onCreateProject={handleCreateProjectRequest}
              onOpenProjects={handleOpenProjectsRequest}
              onOpenActivity={handleOpenActivityRequest}
              onExplore={() => setActiveWorkbench('explore')}
            />
          )}

          {activeWorkbench === 'groups' && (
            <GroupsWorkbench onExplore={() => setActiveWorkbench('explore')} />
          )}
        </div>
        <div className={`mixer-theme ${styles.mixerColumn}`}>
          <AudioRouteBoundary defer deferMs={200}>
            {null}
          </AudioRouteBoundary>
          {audioState ? (
            <Suspense fallback={<MixerPlaceholder />}>
              <Mixer1Channel state={audioState} />
            </Suspense>
          ) : (
            <MixerPlaceholder />
          )}
        </div>
      </div>
    </div>
  );
}

function AccountWorkbench({
  userName,
  isSignedIn,
  onCreateProject,
  onOpenProjects,
  onOpenActivity,
  onExplore
}: {
  userName: string;
  isSignedIn: boolean;
  onCreateProject: () => void;
  onOpenProjects: () => void;
  onOpenActivity: () => void;
  onExplore: () => void;
}) {
  return (
    <>
      <aside className={styles.controlColumn} aria-label="Account controls">
        <h4 className={styles.panelTitle}>Profile controls</h4>
        <div className={styles.controlStack}>
          <div className={styles.controlGroup}>
            <div className={styles.controlLabel}>Mode</div>
            <button type="button" className={`${styles.workbenchToggle} ${styles.workbenchToggleActive}`}>
              Account
            </button>
            <button type="button" className={styles.workbenchToggle} onClick={onOpenProjects}>
              My projects
            </button>
            <button type="button" className={styles.workbenchToggle} onClick={onOpenActivity}>
              My activity
            </button>
            <button type="button" className={styles.workbenchToggle} onClick={onExplore}>
              Explore feed
            </button>
          </div>
          <div className={styles.controlGroup}>
            <div className={styles.controlLabel}>Quick action</div>
            <button type="button" className={styles.workbenchPrimary} onClick={onCreateProject}>
              Create project
            </button>
          </div>
        </div>
      </aside>

      <section className={styles.workbenchPanel} aria-labelledby="account-workbench-title">
        <div className={styles.workbenchPanelHeader}>
          <div>
            <h4 id="account-workbench-title" className={styles.workbenchTitle}>Account</h4>
            <p className={styles.workbenchIntro}>
              Profile settings stay available without disturbing the dashboard console.
            </p>
          </div>
          {isSignedIn ? (
            <Link className={styles.workbenchSecondaryLink} to="/account">Open full account</Link>
          ) : (
            <Link className={styles.workbenchSecondaryLink} to="/auth?mode=login">Login</Link>
          )}
        </div>
        <div className={styles.shellGrid}>
          <div className={styles.shellCard}>
            <span>profile</span>
            <strong>{userName}</strong>
            <p>{isSignedIn ? 'Account details, visibility, and support live in the full account view.' : 'Login to manage profile settings.'}</p>
          </div>
          <div className={styles.shellCard}>
            <span>projects</span>
            <strong>My projects</strong>
            <p>Use the project workbench for creation, moderation, and project history.</p>
            <button type="button" className={styles.inlineAction} onClick={onOpenProjects}>
              Open projects
            </button>
          </div>
        </div>
      </section>
    </>
  );
}

function GroupsWorkbench({ onExplore }: { onExplore: () => void }) {
  return (
    <>
      <aside className={styles.controlColumn} aria-label="Group controls">
        <h4 className={styles.panelTitle}>Group controls</h4>
        <div className={styles.controlStack}>
          <div className={styles.controlGroup}>
            <div className={styles.controlLabel}>Group</div>
            <button type="button" className={`${styles.workbenchToggle} ${styles.workbenchToggleActive}`}>
              All groups
            </button>
            <button type="button" className={styles.workbenchToggle}>
              Active groups
            </button>
            <button type="button" className={styles.workbenchToggle}>
              Group settings
            </button>
          </div>
          <div className={styles.filterSummary}>
            <strong>Placeholder</strong>
            <span>Groups are not implemented yet.</span>
          </div>
        </div>
      </aside>

      <section className={styles.workbenchPanel} aria-labelledby="groups-workbench-title">
        <div className={styles.workbenchPanelHeader}>
          <div>
            <h4 id="groups-workbench-title" className={styles.workbenchTitle}>Groups</h4>
            <p className={styles.workbenchIntro}>
              Groups will be lightweight contexts for external communities, not a replacement social platform.
            </p>
          </div>
          <button type="button" className={styles.workbenchSecondaryLink} onClick={onExplore}>
            Back to explore
          </button>
        </div>
        <div className={styles.shellGrid}>
          <div className={styles.shellCard}>
            <span>context</span>
            <strong>External communities</strong>
            <p>Future group links can point project owners toward whichever real-world community fits the collaboration.</p>
          </div>
          <div className={styles.shellCard}>
            <span>status</span>
            <strong>Not implemented</strong>
            <p>This bay is intentionally a placeholder until the groups backend and product rules exist.</p>
          </div>
        </div>
      </section>
    </>
  );
}
