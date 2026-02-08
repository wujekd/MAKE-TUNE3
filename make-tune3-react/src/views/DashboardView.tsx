import { useEffect, useState } from 'react';
import type { Collaboration } from '../types/collaboration';
import { CollaborationService } from '../services';
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
  const [needsMod, setNeedsMod] = useState<Collaboration[]>([]);
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

  // Compute additional counters
  const totalSubmissions = allCollabs.reduce((sum, c) => sum + (c.submissionsCount || 0), 0);
  const totalVotes = allCollabs.reduce((sum, c) => sum + (c.votesCount || 0), 0);
  const activeCollabs = allCollabs.filter(c => c.status === 'submission' || c.status === 'voting').length;

  return (
    <div className={styles.container}>
      <DashboardHeader
        totalCollabs={totalCollabs}
        filteredCount={filteredCount}
        pendingModeration={pendingModeration}
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
          />
        </div>
        <div className={styles.mixerColumn}>
          <Mixer1Channel state={audioState} />
        </div>
      </div>
    </div>
  );
}
