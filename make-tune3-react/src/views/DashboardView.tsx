import { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import type { Collaboration } from '../types/collaboration';
import { DashboardCollaborationService } from '../services/dashboardCollaborationService';
import { TagUtils } from '../utils/tagUtils';
import { UserActivityPanel } from '../components/UserActivityPanel';
import { DashboardHeader } from '../components/DashboardHeader';
import { DashboardRecommendationsPanel } from '../components/DashboardRecommendationsPanel';
import { CollaborationsPanel } from '../components/CollaborationsPanel';
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
  const [allCollabs, setAllCollabs] = useState<Collaboration[]>([]);
  const [filteredCollabs, setFilteredCollabs] = useState<Collaboration[]>([]);

  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const audioState = useAudioStore(s => s.state);
  const isAudioReady = useAudioStore(s => Boolean(s.engine && s.state));
  const authLoading = useAppStore(state => state.auth.loading);
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

  const prefetchedUrls = useCollabBackingsPrefetch(filteredCollabs, prefetchLimit, prefetchEnabled);
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
        console.log('DashboardView: fetching published collaborations...');
        const list = await DashboardCollaborationService.listPublishedCollaborations();
        console.log('DashboardView: received', list.length, 'published collaborations:', list);
        if (mounted) {
          setAllCollabs(list);
          setFilteredCollabs(list);
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
      return;
    }
    const normalizedSelected = selectedTags.map(tag => TagUtils.normalizeTag(tag)).filter(Boolean);
    const filtered = allCollabs.filter(collab => {
      const rawKeys =
        Array.isArray(collab.tagsKey) && collab.tagsKey.length > 0
          ? collab.tagsKey
          : (collab.tags || []);
      const keys = rawKeys.map(tag => TagUtils.normalizeTag(tag)).filter(Boolean);
      if (keys.length === 0) return false;
      return normalizedSelected.every(tag => keys.includes(tag));
    });
    setFilteredCollabs(filtered);
  }, [selectedTags, allCollabs]);

  const availableTags = useMemo(() => {
    const map = new Map<string, { key: string; name: string; count: number }>();
    for (const collab of allCollabs) {
      const hasKeys = Array.isArray(collab.tagsKey) && collab.tagsKey.length > 0;
      const rawTags = Array.isArray(collab.tags) ? collab.tags : [];
      if (hasKeys) {
        for (let i = 0; i < collab.tagsKey.length; i += 1) {
          const rawKey = collab.tagsKey[i];
          const key = typeof rawKey === 'string' ? TagUtils.normalizeTag(rawKey) : '';
          if (!key) continue;
          const name = rawTags[i] || rawKey || key;
          const existing = map.get(key);
          if (existing) {
            existing.count += 1;
            if (!existing.name && name) existing.name = name;
          } else {
            map.set(key, { key, name, count: 1 });
          }
        }
      } else {
        for (const tag of rawTags) {
          const key = TagUtils.normalizeTag(tag);
          if (!key) continue;
          const name = tag || key;
          const existing = map.get(key);
          if (existing) {
            existing.count += 1;
            if (!existing.name && name) existing.name = name;
          } else {
            map.set(key, { key, name, count: 1 });
          }
        }
      }
    }
    return Array.from(map.values()).sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.name.localeCompare(b.name);
    });
  }, [allCollabs]);

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

  // Compute additional counters
  const totalSubmissions = allCollabs.reduce((sum, c) => sum + (c.submissionsCount || 0), 0);
  const totalVotes = allCollabs.reduce((sum, c) => sum + (c.votesCount || 0), 0);
  const activeCollabs = allCollabs.filter(c => c.status === 'submission' || c.status === 'voting').length;

  return (
    <div className={`view-container ${styles.container}`}>
      <DashboardHeader
        totalCollabs={totalCollabs}
        totalSubmissions={totalSubmissions}
        totalVotes={totalVotes}
        activeCollabs={activeCollabs}
      />

      <div className={styles.content}>
        <div className={styles.mainSplit}>
          <UserActivityPanel />
          <DashboardRecommendationsPanel />
          <CollaborationsPanel
            filteredCollabs={filteredCollabs}
            hasLoaded={hasLoaded}
            error={error}
            selectedTags={selectedTags}
            onTagsChange={handleTagsChange}
            availableTags={availableTags}
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
