import { useEffect, useMemo, useState } from 'react';
import type { Collaboration } from '../types/collaboration';
import { CollaborationService } from '../services';
import { TagUtils } from '../utils/tagUtils';
import { UserActivityPanel } from '../components/UserActivityPanel';
import { DashboardHeader } from '../components/DashboardHeader';
import { CollaborationsPanel } from '../components/CollaborationsPanel';
import { Mixer1Channel } from '../components/Mixer1Channel';
import { useAudioStore } from '../stores';
import { usePlaybackStore } from '../stores/usePlaybackStore';
import { useAppStore } from '../stores/appStore';
import { usePrefetchAudio } from '../hooks/usePrefetchAudio';
import { useCollabBackingsPrefetch } from '../hooks/useCollabBackingsPrefetch';
import styles from './DashboardView.module.css';

export function DashboardView() {
  const [allCollabs, setAllCollabs] = useState<Collaboration[]>([]);
  const [filteredCollabs, setFilteredCollabs] = useState<Collaboration[]>([]);

  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const audioState = useAudioStore(s => s.state);
  const stopBackingPlayback = usePlaybackStore(s => s.stopBackingPlayback);

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
        console.log('DashboardView: fetching published collaborations...');
        const list = await CollaborationService.listPublishedCollaborations();
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
          <Mixer1Channel state={audioState} />
        </div>
      </div>
    </div>
  );
}
