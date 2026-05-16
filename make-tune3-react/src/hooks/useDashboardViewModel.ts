import { useEffect, useRef, useState } from 'react';
import { DashboardService } from '../services/dashboardService';
import { DashboardFeedService } from '../services/dashboardFeedService';
import type { DashboardFeedItem, DashboardFeedMode } from '../services/dashboardFeedService';
import { GroupService } from '../services/groupService';
import { TagService } from '../services/tagService';
import { useAudioStore } from '../stores';
import { useAppStore } from '../stores/appStore';
import { usePlaybackStore } from '../stores/usePlaybackStore';
import type { DashboardProfileMode, DashboardWorkbench } from '../components/DashboardHeader';
import type { Group } from '../types/collaboration';
import { useCollabBackingsPrefetch } from './useCollabBackingsPrefetch';
import { usePrefetchAudio } from './usePrefetchAudio';

type DashboardTagOption = {
  key: string;
  name: string;
  count: number;
};

type DashboardStats = {
  totalCollabs: number;
  totalSubmissions: number;
  totalVotes: number;
  activeCollabs: number;
};

const FEED_PRIORITY_LABELS: Record<DashboardFeedMode, string> = {
  balanced: 'balanced',
  for_you: 'for you',
  fresh: 'fresh',
  active: 'active',
  closing: 'closing soon'
};

export function useDashboardViewModel() {
  const [items, setItems] = useState<DashboardFeedItem[]>([]);
  const [hasLoaded, setHasLoaded] = useState(false);
  const hasLoadedFeedRef = useRef(false);
  const [activeWorkbench, setActiveWorkbench] = useState<DashboardWorkbench>('explore');
  const [projectWorkbenchMode, setProjectWorkbenchMode] = useState<'projects' | 'activity' | 'create'>('projects');
  const [createProjectRequestKey, setCreateProjectRequestKey] = useState(0);
  const [projectsPanelRequestKey, setProjectsPanelRequestKey] = useState(0);
  const [openGroupsRequestKey, setOpenGroupsRequestKey] = useState(0);
  const [createGroupRequestKey, setCreateGroupRequestKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [availableTags, setAvailableTags] = useState<DashboardTagOption[]>([]);
  const [feedMode, setFeedMode] = useState<DashboardFeedMode>('balanced');
  const [feedMetaLabel, setFeedMetaLabel] = useState('');
  const [stats, setStats] = useState<DashboardStats>({
    totalCollabs: 0,
    totalSubmissions: 0,
    totalVotes: 0,
    activeCollabs: 0
  });
  const [myGroups, setMyGroups] = useState<Group[]>([]);
  const [publicGroups, setPublicGroups] = useState<Group[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [groupsError, setGroupsError] = useState<string | null>(null);
  const [groupsRefreshKey, setGroupsRefreshKey] = useState(0);
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
    setGroupsLoading(true);
    setGroupsError(null);

    (async () => {
      try {
        const [publicRows, mineRows] = await Promise.all([
          GroupService.listPublicGroups(),
          userId ? GroupService.listMyGroups() : Promise.resolve([] as Group[])
        ]);
        if (!mounted) return;
        setPublicGroups(publicRows);
        setMyGroups(mineRows);
      } catch (e: any) {
        if (!mounted) return;
        setPublicGroups([]);
        setMyGroups([]);
        setGroupsError(e?.message || 'Unable to load groups right now.');
      } finally {
        if (mounted) {
          setGroupsLoading(false);
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, [authLoading, groupsRefreshKey, userId]);

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
        const baseFeed = await DashboardFeedService.loadFeed({
          mode: feedMode,
          selectedTags,
          includeRecommendations: false
        });
        if (!mounted) return;
        setItems(baseFeed.items);
        setFeedMetaLabel(baseFeed.metaLabel);
        setHasLoaded(true);
        hasLoadedFeedRef.current = true;

        if (!userId) {
          return;
        }

        const personalizedFeed = await DashboardFeedService.loadFeed({
          mode: feedMode,
          selectedTags,
          includeRecommendations: true
        });
        if (!mounted) return;
        setItems(personalizedFeed.items);
        setFeedMetaLabel(personalizedFeed.metaLabel);
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

  const handleCreateProjectRequest = () => {
    setActiveWorkbench('projects');
    setProjectWorkbenchMode('create');
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

  const handleOpenAccountRequest = () => {
    setActiveWorkbench('account');
  };

  const handleOpenGroupsRequest = () => {
    setActiveWorkbench('groups');
    setOpenGroupsRequestKey(key => key + 1);
  };

  const handleCreateGroupRequest = () => {
    setActiveWorkbench('groups');
    setCreateGroupRequestKey(key => key + 1);
  };

  const feedModeLabel = FEED_PRIORITY_LABELS[feedMode];
  const activeProfileMode: DashboardProfileMode = activeWorkbench === 'account'
    ? 'account'
    : activeWorkbench === 'projects'
      ? projectWorkbenchMode
      : null;

  return {
    items,
    hasLoaded,
    activeWorkbench,
    projectWorkbenchMode,
    createProjectRequestKey,
    projectsPanelRequestKey,
    openGroupsRequestKey,
    createGroupRequestKey,
    error,
    selectedTags,
    availableTags,
    feedMode,
    feedMetaLabel,
    feedModeLabel,
    stats,
    myGroups,
    publicGroups,
    groupsLoading,
    groupsError,
    audioState,
    user,
    activeProfileMode,
    setActiveWorkbench,
    setSelectedTags,
    setFeedMode,
    handleCreateProjectRequest,
    handleOpenProjectsRequest,
    handleOpenActivityRequest,
    handleOpenAccountRequest,
    handleOpenGroupsRequest,
    handleCreateGroupRequest,
    handleProjectCreateClosed: () => setProjectWorkbenchMode('projects'),
    handleGroupsChanged: () => setGroupsRefreshKey(key => key + 1)
  };
}

export type DashboardViewModel = ReturnType<typeof useDashboardViewModel>;
