import { Suspense, lazy, useEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { GroupService } from '../services/groupService';
import { UserActivityPanel } from '../components/UserActivityPanel';
import { DashboardHeader } from '../components/DashboardHeader';
import type { DashboardProfileMode } from '../components/DashboardHeader';
import { DashboardCollabsPanel, DashboardExploreControls, DashboardExploreFeed } from '../components/DashboardCollabsPanel';
import { AudioRouteBoundary } from '../components/AudioRouteBoundary';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { SmallLEDMeter } from '../components/SmallLEDMeter';
import { useAudioStore } from '../stores';
import { useAppStore } from '../stores/appStore';
import { useUIStore } from '../stores/useUIStore';
import { usePlaybackStore } from '../stores/usePlaybackStore';
import { useDashboardIsMobile } from '../hooks/useDashboardIsMobile';
import { useDashboardViewModel, type DashboardViewModel } from '../hooks/useDashboardViewModel';
import type { AudioState } from '../types';
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
  const viewModel = useDashboardViewModel();
  const isMobile = useDashboardIsMobile();

  return isMobile
    ? <DashboardMobileLayout viewModel={viewModel} />
    : <DashboardDesktopLayout viewModel={viewModel} />;
}

function DashboardDesktopLayout({ viewModel }: { viewModel: DashboardViewModel }) {
  const {
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
    handleProjectCreateClosed,
    handleGroupsChanged
  } = viewModel;

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
                  onProjectCreateClosed={handleProjectCreateClosed}
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
              onGroupsChanged={handleGroupsChanged}
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

function DashboardMobileLayout({ viewModel }: { viewModel: DashboardViewModel }) {
  const {
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
    feedModeLabel,
    myGroups,
    publicGroups,
    groupsLoading,
    groupsError,
    audioState,
    user,
    setActiveWorkbench,
    setSelectedTags,
    setFeedMode,
    handleCreateProjectRequest,
    handleOpenProjectsRequest,
    handleOpenActivityRequest,
    handleOpenAccountRequest,
    handleOpenGroupsRequest,
    handleCreateGroupRequest,
    handleProjectCreateClosed,
    handleGroupsChanged
  } = viewModel;
  const [exploreControlsOpen, setExploreControlsOpen] = useState(false);
  const profileName = user?.username || user?.email || 'Guest';

  return (
    <div className={`view-container ${styles.container} ${styles.mobileContainer}`}>
      <nav className={styles.mobileTabBar} aria-label="Dashboard sections">
        <button
          type="button"
          className={`${styles.mobileTab} ${activeWorkbench === 'explore' ? styles.mobileTabActive : ''}`}
          onClick={() => setActiveWorkbench('explore')}
        >
          Explore
        </button>
        <button
          type="button"
          className={`${styles.mobileTab} ${activeWorkbench === 'projects' ? styles.mobileTabActive : ''}`}
          onClick={handleOpenProjectsRequest}
        >
          Projects
        </button>
        <button
          type="button"
          className={`${styles.mobileTab} ${activeWorkbench === 'groups' ? styles.mobileTabActive : ''}`}
          onClick={handleOpenGroupsRequest}
        >
          Groups
        </button>
        <button
          type="button"
          className={`${styles.mobileTab} ${activeWorkbench === 'account' ? styles.mobileTabActive : ''}`}
          onClick={handleOpenAccountRequest}
        >
          Account
        </button>
      </nav>

      <main className={styles.mobileContent}>
        {activeWorkbench === 'explore' && (
          <section className={styles.mobilePanel} aria-label="Explore workbench">
            <div className={styles.mobilePanelHeader}>
              <div>
                <h4>Explore feed</h4>
                <p>{selectedTags.length || 'all'} tags - {feedModeLabel}</p>
              </div>
              <button
                type="button"
                className={styles.mobileUtilityButton}
                aria-expanded={exploreControlsOpen}
                onClick={() => setExploreControlsOpen(open => !open)}
              >
                Filters
              </button>
            </div>
            {exploreControlsOpen && (
              <div className={styles.mobileControlSheet}>
                <DashboardExploreControls
                  hasLoaded={hasLoaded}
                  selectedTags={selectedTags}
                  onTagsChange={setSelectedTags}
                  availableTags={availableTags}
                  feedMode={feedMode}
                  onFeedModeChange={setFeedMode}
                />
              </div>
            )}
            <DashboardExploreFeed
              items={items}
              hasLoaded={hasLoaded}
              error={error}
              selectedTags={selectedTags}
            />
          </section>
        )}

        {activeWorkbench === 'projects' && (
          <section className={`${styles.mobilePanel} ${styles.mobileProjectPanel}`} aria-label="Projects workbench">
            <MobileProfileActions
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
                onProjectCreateClosed={handleProjectCreateClosed}
              />
            </div>
          </section>
        )}

        {activeWorkbench === 'account' && (
          <section className={styles.mobilePanel} aria-label="Account workbench">
            <MobileProfileActions
              activeMode="account"
              isSignedIn={Boolean(user)}
              onAccount={handleOpenAccountRequest}
              onCreateProject={handleCreateProjectRequest}
              onOpenProjects={handleOpenProjectsRequest}
              onOpenActivity={handleOpenActivityRequest}
              onExplore={() => setActiveWorkbench('explore')}
            />
            <AccountWorkbench
              userName={profileName}
              isSignedIn={Boolean(user)}
              onOpenProjects={handleOpenProjectsRequest}
            />
          </section>
        )}

        {activeWorkbench === 'groups' && (
          <section className={styles.mobilePanel} aria-label="Groups workbench">
            <div className={styles.mobilePanelHeader}>
              <div>
                <h4>Groups</h4>
                <p>{user ? `${myGroups.length} joined` : `${publicGroups.length} public`} - rooms and project spaces</p>
              </div>
              <button
                type="button"
                className={styles.mobileUtilityButton}
                onClick={handleCreateGroupRequest}
              >
                Create
              </button>
            </div>
            <GroupsWorkbench
              myGroups={myGroups}
              publicGroups={publicGroups}
              loading={groupsLoading}
              error={groupsError}
              openRequestKey={openGroupsRequestKey}
              createRequestKey={createGroupRequestKey}
              onGroupsChanged={handleGroupsChanged}
              onExplore={() => setActiveWorkbench('explore')}
            />
          </section>
        )}
      </main>

      <div className={`mixer-theme ${styles.mobileMixerTray}`} aria-label="Mobile mixer">
        <AudioRouteBoundary defer deferMs={200}>
          {null}
        </AudioRouteBoundary>
        <MobileTransportBar state={audioState} />
      </div>
    </div>
  );
}

function MobileTransportBar({ state }: { state: AudioState | null }) {
  const audioEngine = useAudioStore(s => s.engine);
  const [channelLevel, setChannelLevel] = useState(0);
  const levelRef = useRef(0);
  const levelLastTsRef = useRef<number | null>(null);
  const togglePlayPause = useAppStore(s => s.playback.togglePlayPause);
  const handleTimeSliderChange = useAppStore(s => s.playback.handleTimeSliderChange);
  const getTimeSliderValue = useAppStore(s => s.playback.getTimeSliderValue);
  const stopBackingPlayback = usePlaybackStore(s => s.stopBackingPlayback);

  useEffect(() => {
    if (!audioEngine) return;
    const unsubscribe = audioEngine.onPlayer2Level(({ rms }) => {
      const now = performance.now();
      const last = levelLastTsRef.current ?? now;
      const dt = Math.max(0, (now - last) / 1000);
      levelLastTsRef.current = now;
      const target = Math.max(0, Math.min(1, rms * 4.5));
      const current = levelRef.current;
      const tau = target > current ? 0.05 : 0.3;
      const next = current + (target - current) * (1 - Math.exp(-dt / tau));
      levelRef.current = next;
      setChannelLevel(next);
    });

    return unsubscribe;
  }, [audioEngine]);

  const hasSource = Boolean(state?.player2.source);
  const isPlaying = Boolean(state?.player2.isPlaying);
  const sliderValue = state ? getTimeSliderValue(state) : 0;

  return (
    <div className={styles.mobileTransport}>
      <button
        type="button"
        className={styles.mobileTransportButton}
        onClick={togglePlayPause}
        disabled={!hasSource}
        aria-label={isPlaying ? 'Pause' : 'Play'}
        title={isPlaying ? 'Pause' : 'Play'}
      >
        {isPlaying ? '⏸' : '▶'}
      </button>
      <button
        type="button"
        className={styles.mobileTransportButton}
        onClick={() => stopBackingPlayback()}
        disabled={!hasSource}
        aria-label="Stop"
        title="Stop"
      >
        ■
      </button>
      <input
        type="range"
        className={styles.mobileTransportSlider}
        min="0"
        max="100"
        step="0.1"
        value={sliderValue}
        onChange={event => handleTimeSliderChange(parseFloat(event.target.value))}
        disabled={!hasSource}
        aria-label="Playback position"
      />
      <SmallLEDMeter value={channelLevel} min={0} max={1} vertical ledCount={3} />
    </div>
  );
}

function MobileProfileActions({
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
  return (
    <div className={styles.mobileActionDock} aria-label="Profile controls">
      <button
        type="button"
        className={`${styles.mobileAction} ${activeMode === 'account' ? styles.mobileActionActive : ''}`}
        onClick={onAccount}
      >
        Account
      </button>
      <button
        type="button"
        className={`${styles.mobileAction} ${activeMode === 'projects' ? styles.mobileActionActive : ''}`}
        onClick={onOpenProjects}
      >
        My projects
      </button>
      <button
        type="button"
        className={`${styles.mobileAction} ${activeMode === 'activity' ? styles.mobileActionActive : ''}`}
        onClick={onOpenActivity}
      >
        Activity
      </button>
      <button
        type="button"
        className={`${styles.mobileActionPrimary} ${activeMode === 'create' ? styles.mobileActionActive : ''}`}
        onClick={onCreateProject}
      >
        {isSignedIn ? 'Create' : 'Login'}
      </button>
      <button type="button" className={styles.mobileActionWide} onClick={onExplore}>
        Explore feed
      </button>
    </div>
  );
}

function ProfileControls({
  activeMode,
  isSignedIn: _isSignedIn,
  onAccount,
  onCreateProject: _onCreateProject,
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
  const openFeedbackModal = useUIStore(state => state.openFeedbackModal);

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
        <button
          type="button"
          className={styles.giveFeedbackButton}
          onClick={() => openFeedbackModal()}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          Give feedback
        </button>
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
              className={`${styles.workbenchPrimary} ${mode === 'create' ? styles.workbenchPrimaryActive : ''}`}
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
