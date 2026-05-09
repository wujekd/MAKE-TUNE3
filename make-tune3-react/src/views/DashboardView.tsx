import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { DashboardService } from '../services/dashboardService';
import { DashboardFeedService } from '../services/dashboardFeedService';
import type { DashboardFeedItem, DashboardFeedMode } from '../services/dashboardFeedService';
import { TagService } from '../services/tagService';
import { UserActivityPanel } from '../components/UserActivityPanel';
import { DashboardHeader } from '../components/DashboardHeader';
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
  const { loading: authLoading, user } = useAppStore(state => state.auth);
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
  }, [authLoading, feedMode, selectedTags, user?.uid]);

  useEffect(() => {
    return () => {
      stopBackingPlayback();
    };
  }, [stopBackingPlayback]);

  // removed direct navigate wrapper; using <Link to> below

  // always render view; hydrate when data arrives

  return (
    <div className={`view-container ${styles.container}`}>
      <DashboardHeader
        totalCollabs={stats.totalCollabs}
        totalSubmissions={stats.totalSubmissions}
        totalVotes={stats.totalVotes}
        activeCollabs={stats.activeCollabs}
      />

      <div className={styles.content}>
        <div className={styles.mainSplit}>
          <UserActivityPanel />
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
