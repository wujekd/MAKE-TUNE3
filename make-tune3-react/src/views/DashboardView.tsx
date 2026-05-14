import { Suspense, lazy, useEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { DashboardService } from '../services/dashboardService';
import { DashboardFeedService } from '../services/dashboardFeedService';
import type { DashboardFeedItem, DashboardFeedMode } from '../services/dashboardFeedService';
import { GroupService } from '../services/groupService';
import { TagService } from '../services/tagService';
import { UserActivityPanel } from '../components/UserActivityPanel';
import { DashboardHeader } from '../components/DashboardHeader';
import type { DashboardProfileMode, DashboardWorkbench } from '../components/DashboardHeader';
import { DashboardCollabsPanel } from '../components/DashboardCollabsPanel';
import { AudioRouteBoundary } from '../components/AudioRouteBoundary';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { useAudioStore } from '../stores';
import { usePlaybackStore } from '../stores/usePlaybackStore';
import { useAppStore } from '../stores/appStore';
import { usePrefetchAudio } from '../hooks/usePrefetchAudio';
import { useCollabBackingsPrefetch } from '../hooks/useCollabBackingsPrefetch';
import type { Collaboration, Group, GroupJoinPolicy, GroupMember, GroupVisibility, Project } from '../types/collaboration';
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
  const [projectWorkbenchMode, setProjectWorkbenchMode] = useState<'projects' | 'activity' | 'create'>('projects');
  const [createProjectRequestKey, setCreateProjectRequestKey] = useState(0);
  const [projectsPanelRequestKey, setProjectsPanelRequestKey] = useState(0);
  const [openGroupsRequestKey, setOpenGroupsRequestKey] = useState(0);
  const [createGroupRequestKey, setCreateGroupRequestKey] = useState(0);
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

  const feedModeLabel = feedMode.replace('_', ' ');
  const activeProfileMode: DashboardProfileMode = activeWorkbench === 'account'
    ? 'account'
    : activeWorkbench === 'projects'
      ? projectWorkbenchMode
      : null;

  return (
    <div className={`view-container ${styles.container}`}>
      <DashboardHeader
        totalCollabs={stats.totalCollabs}
        totalSubmissions={stats.totalSubmissions}
        totalVotes={stats.totalVotes}
        activeCollabs={stats.activeCollabs}
        myGroupCount={myGroups.length}
        publicGroupCount={publicGroups.length}
        activeWorkbench={activeWorkbench}
        profileMode={activeProfileMode}
        selectedTagCount={selectedTags.length}
        feedModeLabel={feedModeLabel}
        onWorkbenchChange={setActiveWorkbench}
        onCreateProjectRequest={handleCreateProjectRequest}
        onOpenProjectsRequest={handleOpenProjectsRequest}
        onOpenGroupsRequest={handleOpenGroupsRequest}
        onCreateGroupRequest={handleCreateGroupRequest}
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
              <ProfileControls
                activeMode={projectWorkbenchMode}
                isSignedIn={Boolean(user)}
                onAccount={handleOpenAccountRequest}
                onCreateProject={handleCreateProjectRequest}
                onOpenProjects={handleOpenProjectsRequest}
                onOpenActivity={handleOpenActivityRequest}
                onExplore={() => setActiveWorkbench('explore')}
              />
              <div className={`project-history ${styles.historyColumn}`}>
                <UserActivityPanel
                  createProjectRequestKey={createProjectRequestKey}
                  projectsPanelRequestKey={projectsPanelRequestKey}
                  activeTabOverride={projectWorkbenchMode === 'activity' ? 'activity' : 'projects'}
                  hideTabs
                  onProjectCreateClosed={() => setProjectWorkbenchMode('projects')}
                />
              </div>
            </>
          )}

          {activeWorkbench === 'account' && (
            <>
              <ProfileControls
                activeMode="account"
                isSignedIn={Boolean(user)}
                onAccount={handleOpenAccountRequest}
                onCreateProject={handleCreateProjectRequest}
                onOpenProjects={handleOpenProjectsRequest}
                onOpenActivity={handleOpenActivityRequest}
                onExplore={() => setActiveWorkbench('explore')}
              />
              <AccountWorkbench
                userName={user?.username || user?.email || 'Guest'}
                isSignedIn={Boolean(user)}
                onOpenProjects={handleOpenProjectsRequest}
              />
            </>
          )}

          {activeWorkbench === 'groups' && (
            <GroupsWorkbench
              myGroups={myGroups}
              publicGroups={publicGroups}
              loading={groupsLoading}
              error={groupsError}
              openRequestKey={openGroupsRequestKey}
              createRequestKey={createGroupRequestKey}
              onGroupsChanged={() => setGroupsRefreshKey(key => key + 1)}
              onExplore={() => setActiveWorkbench('explore')}
            />
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

function ProfileControls({
  activeMode,
  isSignedIn,
  onAccount,
  onCreateProject,
  onOpenProjects,
  onOpenActivity,
  onExplore
}: {
  activeMode: NonNullable<DashboardProfileMode>;
  isSignedIn: boolean;
  onAccount: () => void;
  onCreateProject: () => void;
  onOpenProjects: () => void;
  onOpenActivity: () => void;
  onExplore: () => void;
}) {
  const summary = activeMode === 'account'
    ? {
        title: isSignedIn ? 'Account workbench' : 'Login required',
        text: isSignedIn ? 'Profile settings stay in the center bay.' : 'Sign in to use profile controls.'
      }
    : activeMode === 'activity'
      ? {
          title: isSignedIn ? 'Activity workbench' : 'Login required',
          text: isSignedIn ? 'Your recent activity stays in the center bay.' : 'Sign in to review your activity.'
        }
      : activeMode === 'create'
        ? {
            title: isSignedIn ? 'Create project' : 'Login required',
            text: isSignedIn ? 'Set up a project in the center bay.' : 'Sign in to create projects.'
          }
      : {
          title: isSignedIn ? 'Project workbench' : 'Login required',
          text: isSignedIn ? 'Your project list stays in the center bay.' : 'Sign in to create or manage projects.'
        };

  return (
    <aside className={styles.controlColumn} aria-label="Profile controls">
      <h4 className={styles.panelTitle}>Profile controls</h4>
      <div className={styles.controlStack}>
        <div className={styles.controlGroup}>
          <div className={styles.controlLabel}>Mode</div>
          <button
            type="button"
            className={`${styles.workbenchToggle} ${activeMode === 'account' ? styles.workbenchToggleActive : ''}`}
            onClick={onAccount}
          >
            Account
          </button>
          <button
            type="button"
            className={`${styles.workbenchToggle} ${activeMode === 'projects' ? styles.workbenchToggleActive : ''}`}
            onClick={onOpenProjects}
          >
            My projects
          </button>
          <button
            type="button"
            className={`${styles.workbenchToggle} ${activeMode === 'activity' ? styles.workbenchToggleActive : ''}`}
            onClick={onOpenActivity}
          >
            My activity
          </button>
        </div>
        <div className={styles.controlGroup}>
          <div className={styles.controlLabel}>Return</div>
          <button type="button" className={styles.workbenchReturn} onClick={onExplore}>
            Back to Explore feed
          </button>
        </div>
        <div className={styles.controlGroup}>
          <div className={styles.controlLabel}>Quick action</div>
          <button
            type="button"
            className={`${styles.workbenchPrimary} ${activeMode === 'create' ? styles.workbenchPrimaryActive : ''}`}
            onClick={onCreateProject}
          >
            Create project
          </button>
        </div>
        <div className={styles.filterSummary}>
          <strong>{summary.title}</strong>
          <span>{summary.text}</span>
        </div>
      </div>
    </aside>
  );
}

function AccountWorkbench({
  userName,
  isSignedIn,
  onOpenProjects
}: {
  userName: string;
  isSignedIn: boolean;
  onOpenProjects: () => void;
}) {
  return (
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
  );
}

function GroupsWorkbench({
  myGroups,
  publicGroups,
  loading,
  error,
  openRequestKey,
  createRequestKey,
  onGroupsChanged,
  onExplore
}: {
  myGroups: Group[];
  publicGroups: Group[];
  loading: boolean;
  error: string | null;
  openRequestKey: number;
  createRequestKey: number;
  onGroupsChanged: () => void;
  onExplore: () => void;
}) {
  const user = useAppStore(state => state.auth.user);
  const [mode, setMode] = useState<'mine' | 'public' | 'create'>('mine');
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [membership, setMembership] = useState<GroupMember | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [groupProjects, setGroupProjects] = useState<Project[]>([]);
  const [groupCollaborations, setGroupCollaborations] = useState<Collaboration[]>([]);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [inviteUrl, setInviteUrl] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [actionError, setActionError] = useState('');
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<GroupVisibility>('public');
  const [joinPolicy, setJoinPolicy] = useState<GroupJoinPolicy>('open');
  const [externalLabel, setExternalLabel] = useState('');
  const [externalUrl, setExternalUrl] = useState('');

  const visibleGroups = mode === 'public' ? publicGroups : myGroups;
  const isActiveMember = membership?.status === 'active';
  const pendingMembers = members.filter(member => member.status === 'requested');

  useEffect(() => {
    if (openRequestKey > 0) {
      setMode('mine');
    }
  }, [openRequestKey]);

  useEffect(() => {
    if (createRequestKey > 0) {
      setMode('create');
    }
  }, [createRequestKey]);

  useEffect(() => {
    if (mode === 'create') {
      return;
    }
    if (selectedGroupId) {
      return;
    }
    setSelectedGroupId(visibleGroups[0]?.id ?? null);
  }, [mode, selectedGroupId, visibleGroups]);

  useEffect(() => {
    if (!selectedGroupId || mode === 'create') {
      setSelectedGroup(null);
      setMembership(null);
      setCanManage(false);
      setGroupProjects([]);
      setGroupCollaborations([]);
      setMembers([]);
      return;
    }

    let mounted = true;
    setDetailsLoading(true);
    setDetailsError(null);
    setInviteUrl('');
    setActionError('');
    setActionMessage('');

    (async () => {
      try {
        const details = await GroupService.getGroup(selectedGroupId);
        if (!mounted) return;
        setSelectedGroup(details.group);
        setMembership(details.membership);
        setCanManage(details.canManage);

        const [projects, collaborations, memberRows] = await Promise.all([
          GroupService.listGroupProjects(selectedGroupId),
          GroupService.listGroupCollaborations(selectedGroupId),
          details.canManage ? GroupService.listGroupMembers(selectedGroupId) : Promise.resolve([] as GroupMember[])
        ]);
        if (!mounted) return;
        setGroupProjects(projects);
        setGroupCollaborations(collaborations);
        setMembers(memberRows);
      } catch (e: any) {
        if (!mounted) return;
        setSelectedGroup(null);
        setMembership(null);
        setCanManage(false);
        setGroupProjects([]);
        setGroupCollaborations([]);
        setMembers([]);
        setDetailsError(e?.message || 'Unable to load this group.');
      } finally {
        if (mounted) {
          setDetailsLoading(false);
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, [mode, selectedGroupId]);

  const refreshSelectedGroup = () => {
    const groupId = selectedGroupId;
    setSelectedGroupId(null);
    window.setTimeout(() => setSelectedGroupId(groupId), 0);
  };

  const handleCreateGroup = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user) {
      setActionError('Login to create a group.');
      return;
    }
    if (!name.trim()) {
      setActionError('Give the group a name.');
      return;
    }

    setCreating(true);
    setActionError('');
    setActionMessage('');
    try {
      const links = externalUrl.trim()
        ? [{
            type: 'external',
            label: externalLabel.trim() || 'Community home',
            url: externalUrl.trim()
          }]
        : [];
      const group = await GroupService.createGroup({
        name: name.trim(),
        description: description.trim(),
        visibility,
        joinPolicy,
        externalLinks: links
      });
      setName('');
      setDescription('');
      setExternalLabel('');
      setExternalUrl('');
      setMode('mine');
      setSelectedGroupId(group.id);
      onGroupsChanged();
      setActionMessage('Group created.');
    } catch (e: any) {
      setActionError(e?.message || 'Unable to create group.');
    } finally {
      setCreating(false);
    }
  };

  const handleJoinOrRequest = async () => {
    if (!selectedGroup) return;
    if (!user) {
      setActionError('Login to join or request access.');
      return;
    }

    setActionError('');
    setActionMessage('');
    try {
      if (selectedGroup.joinPolicy === 'open') {
        await GroupService.joinOpenGroup(selectedGroup.id);
        setActionMessage('Joined group.');
      } else if (selectedGroup.joinPolicy === 'approval_required') {
        await GroupService.requestGroupAccess(selectedGroup.id);
        setActionMessage('Request sent.');
      } else {
        setActionError('This group uses admin invitation links.');
        return;
      }
      onGroupsChanged();
      refreshSelectedGroup();
    } catch (e: any) {
      setActionError(e?.message || 'Unable to update membership.');
    }
  };

  const handleCreateInvite = async () => {
    if (!selectedGroup) return;
    setActionError('');
    setActionMessage('');
    try {
      const invite = await GroupService.createGroupInvite(selectedGroup.id);
      const origin = window.location.origin;
      setInviteUrl(`${origin}/group/join/${encodeURIComponent(invite.inviteId)}`);
      setActionMessage('Invite link created.');
    } catch (e: any) {
      setActionError(e?.message || 'Unable to create invite link.');
    }
  };

  const handleApprove = async (member: GroupMember) => {
    if (!selectedGroup) return;
    setActionError('');
    setActionMessage('');
    try {
      await GroupService.approveGroupMember(selectedGroup.id, member.userId);
      setActionMessage('Member approved.');
      onGroupsChanged();
      refreshSelectedGroup();
    } catch (e: any) {
      setActionError(e?.message || 'Unable to approve member.');
    }
  };

  const selectedSummary = selectedGroup
    ? `${selectedGroup.visibility} group - ${selectedGroup.joinPolicy.replace('_', ' ')}`
    : loading
      ? 'Loading groups'
      : mode === 'public'
        ? `${publicGroups.length} public groups`
        : `${myGroups.length} joined groups`;

  const renderGroupList = () => {
    if (loading) {
      return <div className={styles.groupMessage}>Loading groups...</div>;
    }
    if (error) {
      return <div className={styles.groupMessage}>{error}</div>;
    }
    if (!visibleGroups.length) {
      return (
        <div className={styles.groupMessage}>
          {mode === 'public' ? 'No public groups yet.' : user ? 'You have not joined any groups yet.' : 'Login to see your groups.'}
        </div>
      );
    }
    return visibleGroups.map(group => (
      <button
        key={group.id}
        type="button"
        className={`${styles.groupListButton} ${group.id === selectedGroupId ? styles.groupListButtonActive : ''}`}
        onClick={() => setSelectedGroupId(group.id)}
      >
        <strong>{group.name}</strong>
        <span>{group.visibility} - {group.joinPolicy.replace('_', ' ')}</span>
      </button>
    ));
  };

  const collaborationRoute = (collaboration: Collaboration) => {
    if (collaboration.status === 'submission') {
      return `/collab/${encodeURIComponent(collaboration.id)}/submit`;
    }
    if (collaboration.status === 'completed') {
      return `/collab/${encodeURIComponent(collaboration.id)}/completed`;
    }
    return `/collab/${encodeURIComponent(collaboration.id)}`;
  };

  return (
    <>
      <aside className={styles.controlColumn} aria-label="Group controls">
        <h4 className={styles.panelTitle}>Group controls</h4>
        <div className={styles.controlStack}>
          <div className={styles.controlGroup}>
            <div className={styles.controlLabel}>Mode</div>
            <button
              type="button"
              className={`${styles.workbenchToggle} ${mode === 'mine' ? styles.workbenchToggleActive : ''}`}
              onClick={() => setMode('mine')}
            >
              My groups
            </button>
            <button
              type="button"
              className={`${styles.workbenchToggle} ${mode === 'public' ? styles.workbenchToggleActive : ''}`}
              onClick={() => setMode('public')}
            >
              Public groups
            </button>
            <button
              type="button"
              className={`${styles.workbenchToggle} ${mode === 'create' ? styles.workbenchToggleActive : ''}`}
              onClick={() => setMode('create')}
            >
              Create group
            </button>
            <button type="button" className={styles.workbenchToggle} onClick={onExplore}>
              Explore feed
            </button>
          </div>
          {mode !== 'create' && (
            <div className={styles.controlGroup}>
              <div className={styles.controlLabel}>Groups</div>
              <div className={styles.groupList}>{renderGroupList()}</div>
            </div>
          )}
          <div className={styles.filterSummary}>
            <strong>{selectedSummary}</strong>
            <span>Groups organize projects and collaborations without adding chat, posts, or another feed.</span>
          </div>
        </div>
      </aside>

      <section className={styles.workbenchPanel} aria-labelledby="groups-workbench-title">
        <div className={styles.workbenchPanelHeader}>
          <div>
            <h4 id="groups-workbench-title" className={styles.workbenchTitle}>Groups</h4>
            <p className={styles.workbenchIntro}>
              Create lightweight music rooms for existing communities and attach projects or collaborations to them.
            </p>
          </div>
          {selectedGroup ? (
            <Link className={styles.workbenchSecondaryLink} to={`/group/${encodeURIComponent(selectedGroup.id)}`}>
              Open group page
            </Link>
          ) : (
            <button type="button" className={styles.workbenchSecondaryLink} onClick={onExplore}>
              Back to explore
            </button>
          )}
        </div>

        {mode === 'create' ? (
          <form className={styles.groupForm} onSubmit={handleCreateGroup}>
            <label>
              <span>Name</span>
              <input value={name} onChange={event => setName(event.target.value)} placeholder="Sunday drummers" />
            </label>
            <label>
              <span>Description</span>
              <textarea value={description} onChange={event => setDescription(event.target.value)} placeholder="A room for collaborations from this community." />
            </label>
            <div className={styles.groupFormGrid}>
              <label>
                <span>Visibility</span>
                <select value={visibility} onChange={event => setVisibility(event.target.value as GroupVisibility)}>
                  <option value="public">Public</option>
                  <option value="unlisted">Unlisted</option>
                  <option value="private">Private</option>
                </select>
              </label>
              <label>
                <span>Joining</span>
                <select value={joinPolicy} onChange={event => setJoinPolicy(event.target.value as GroupJoinPolicy)}>
                  <option value="open">Open</option>
                  <option value="approval_required">Approval required</option>
                  <option value="invite_link">Invite link only</option>
                </select>
              </label>
            </div>
            <div className={styles.groupFormGrid}>
              <label>
                <span>External label</span>
                <input value={externalLabel} onChange={event => setExternalLabel(event.target.value)} placeholder="Discord" />
              </label>
              <label>
                <span>External URL</span>
                <input value={externalUrl} onChange={event => setExternalUrl(event.target.value)} placeholder="https://..." />
              </label>
            </div>
            {actionError && <div className={styles.groupError}>{actionError}</div>}
            {actionMessage && <div className={styles.groupNotice}>{actionMessage}</div>}
            <button type="submit" className={styles.workbenchPrimary} disabled={creating}>
              {creating ? 'Creating...' : 'Create group'}
            </button>
          </form>
        ) : (
          <div className={styles.groupWorkbenchBody}>
            {detailsLoading && <div className={styles.groupMessage}>Loading group...</div>}
            {detailsError && <div className={styles.groupError}>{detailsError}</div>}
            {!detailsLoading && !detailsError && !selectedGroup && (
              <div className={styles.groupEmptyState}>
                <strong>{mode === 'public' ? 'No public group selected' : 'No group selected'}</strong>
                <p>Pick a group from the left, browse public groups, or create the first one for a community.</p>
                <button type="button" className={styles.workbenchPrimary} onClick={() => setMode('create')}>
                  Create group
                </button>
              </div>
            )}
            {selectedGroup && (
              <>
                <div className={styles.groupHero}>
                  <div>
                    <span>{selectedGroup.visibility} - {selectedGroup.joinPolicy.replace('_', ' ')}</span>
                    <h5>{selectedGroup.name}</h5>
                    <p>{selectedGroup.description || 'No description yet.'}</p>
                  </div>
                  <div className={styles.groupHeroActions}>
                    {!isActiveMember && selectedGroup.joinPolicy !== 'invite_link' && (
                      <button type="button" className={styles.workbenchPrimary} onClick={handleJoinOrRequest}>
                        {selectedGroup.joinPolicy === 'open' ? 'Join group' : 'Request access'}
                      </button>
                    )}
                    {canManage && (
                      <button type="button" className={styles.inlineAction} onClick={handleCreateInvite}>
                        Create invite
                      </button>
                    )}
                  </div>
                </div>

                {(actionError || actionMessage || inviteUrl) && (
                  <div className={styles.groupStatusStack}>
                    {actionError && <div className={styles.groupError}>{actionError}</div>}
                    {actionMessage && <div className={styles.groupNotice}>{actionMessage}</div>}
                    {inviteUrl && (
                      <input className={styles.groupInviteField} readOnly value={inviteUrl} onFocus={event => event.currentTarget.select()} />
                    )}
                  </div>
                )}

                <div className={styles.shellGrid}>
                  <div className={styles.shellCard}>
                    <span>membership</span>
                    <strong>{isActiveMember ? membership?.role || 'member' : membership?.status || 'not joined'}</strong>
                    <p>{canManage ? `${pendingMembers.length} access request${pendingMembers.length === 1 ? '' : 's'} pending.` : 'Membership controls decide who can submit or vote when a collaboration uses group access.'}</p>
                  </div>
                  <div className={styles.shellCard}>
                    <span>external home</span>
                    <strong>{selectedGroup.externalLinks?.length ? selectedGroup.externalLinks[0].label || selectedGroup.externalLinks[0].type : 'Not linked'}</strong>
                    <p>{selectedGroup.externalLinks?.length ? selectedGroup.externalLinks[0].url : 'Add community homes such as Discord, Facebook, Reddit, forums, or label sites when creating the group.'}</p>
                    {selectedGroup.externalLinks?.[0]?.url && (
                      <a className={styles.inlineAction} href={selectedGroup.externalLinks[0].url} target="_blank" rel="noreferrer">
                        Open link
                      </a>
                    )}
                  </div>
                </div>

                {canManage && pendingMembers.length > 0 && (
                  <div className={styles.groupSection}>
                    <div className={styles.groupSectionHeader}>
                      <span>requests</span>
                      <strong>{pendingMembers.length} pending</strong>
                    </div>
                    <div className={styles.groupListWide}>
                      {pendingMembers.map(member => (
                        <div className={styles.groupRow} key={member.userId}>
                          <span>{member.userId}</span>
                          <button type="button" className={styles.inlineAction} onClick={() => handleApprove(member)}>
                            Approve
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className={styles.groupSection}>
                  <div className={styles.groupSectionHeader}>
                    <span>collaborations</span>
                    <strong>{groupCollaborations.length}</strong>
                  </div>
                  <div className={styles.groupListWide}>
                    {groupCollaborations.length === 0 ? (
                      <div className={styles.groupMessage}>No collaborations in this group yet.</div>
                    ) : groupCollaborations.map(collaboration => (
                      <Link key={collaboration.id} className={styles.groupRow} to={collaborationRoute(collaboration)}>
                        <span>{collaboration.name}</span>
                        <em>{collaboration.status}</em>
                      </Link>
                    ))}
                  </div>
                </div>

                <div className={styles.groupSection}>
                  <div className={styles.groupSectionHeader}>
                    <span>projects</span>
                    <strong>{groupProjects.length}</strong>
                  </div>
                  <div className={styles.groupListWide}>
                    {groupProjects.length === 0 ? (
                      <div className={styles.groupMessage}>No projects attached to this group yet.</div>
                    ) : groupProjects.map(project => (
                      <Link key={project.id} className={styles.groupRow} to={`/project/${encodeURIComponent(project.id)}`}>
                        <span>{project.name}</span>
                        <em>{project.currentCollaborationStatus || 'project'}</em>
                      </Link>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </section>
    </>
  );
}
