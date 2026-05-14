import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../stores/appStore';
import { useUIStore } from '../stores/useUIStore';
import { CountUpValue } from './CountUpValue';
import { canCreateProject } from '../utils/permissions';
import styles from '../views/DashboardView.module.css';

export type DashboardWorkbench = 'explore' | 'projects' | 'account' | 'groups';
export type DashboardProfileMode = 'account' | 'projects' | 'activity' | 'create' | null;

interface DashboardHeaderProps {
  totalCollabs: number;
  totalSubmissions: number;
  totalVotes: number;
  activeCollabs: number;
  myGroupCount: number;
  publicGroupCount: number;
  activeWorkbench: DashboardWorkbench;
  profileMode: DashboardProfileMode;
  selectedTagCount: number;
  feedModeLabel: string;
  onWorkbenchChange: (workbench: DashboardWorkbench) => void;
  onCreateProjectRequest: () => void;
  onOpenProjectsRequest: () => void;
  onOpenGroupsRequest: () => void;
  onCreateGroupRequest: () => void;
}

const compactFormatter = new Intl.NumberFormat('en', {
  notation: 'compact',
  maximumFractionDigits: 1
});

const formatCount = (value: number) => {
  if (!Number.isFinite(value)) return '0';
  return Math.abs(value) >= 10000 ? compactFormatter.format(value) : String(value);
};

export function DashboardHeader({
  totalCollabs,
  totalSubmissions,
  totalVotes,
  activeCollabs,
  myGroupCount,
  publicGroupCount,
  activeWorkbench,
  profileMode,
  selectedTagCount,
  feedModeLabel,
  onWorkbenchChange,
  onCreateProjectRequest,
  onOpenProjectsRequest,
  onOpenGroupsRequest,
  onCreateGroupRequest
}: DashboardHeaderProps) {
  const navigate = useNavigate();
  const user = useAppStore(state => state.auth.user);
  const openFeedbackModal = useUIStore(state => state.openFeedbackModal);
  const profileName = user?.username || user?.email || 'Guest profile';
  const projectCount = user?.projectCount ?? 0;
  const tierLabel = user?.tier || 'free';
  const isAccountActive = activeWorkbench === 'account' && profileMode === 'account';
  const isProjectsActive = activeWorkbench === 'projects' && profileMode === 'projects';
  const isCreateActive = activeWorkbench === 'projects' && profileMode === 'create';

  const handleCreateProjectClick = () => {
    if (!user) {
      navigate('/auth?mode=login');
      return;
    }

    if (!canCreateProject(user)) {
      openFeedbackModal('creator_request');
      return;
    }

    onWorkbenchChange('projects');
    onCreateProjectRequest();
  };

  const handleOpenProjectsClick = () => {
    if (!user) {
      navigate('/auth?mode=login');
      return;
    }

    onWorkbenchChange('projects');
    onOpenProjectsRequest();
  };

  const handleExploreClick = () => {
    onWorkbenchChange('explore');
    document.getElementById('collaboration-feed')?.scrollIntoView({
      block: 'nearest',
      behavior: 'smooth'
    });
  };

  return (
    <section className={styles.console} aria-label="Dashboard console">
      <div className={`${styles.consoleZone} ${styles.consoleZoneProfile}`}>
        <div className={styles.consoleTitle}>Profile</div>
        <button
          type="button"
          className={styles.consoleStatus}
          onClick={() => onWorkbenchChange('account')}
          aria-pressed={isAccountActive}
        >
          <strong>{profileName}</strong>
          <span>{user ? `${tierLabel} tier - account and activity ready` : 'Login to use profile controls'}</span>
        </button>
        <div className={styles.consoleMeterRow}>
          <ConsoleMeter label="projects" value={projectCount} />
          <ConsoleMeter label="collabs" value={totalCollabs} />
          <ConsoleMeter label="votes" value={totalVotes} />
        </div>
        <div className={styles.profileActionGrid} aria-label="Profile actions">
          <button
            type="button"
            className={`${styles.consolePrimaryButton} ${isCreateActive ? styles.consoleButtonActive : ''}`}
            onClick={handleCreateProjectClick}
          >
            Create project
          </button>
          <button
            type="button"
            className={`${styles.consoleButton} ${isAccountActive ? styles.consoleButtonActive : ''}`}
            onClick={() => onWorkbenchChange('account')}
          >
            Account
          </button>
          <button
            type="button"
            className={`${styles.consoleButton} ${isProjectsActive ? styles.consoleButtonActive : ''}`}
            onClick={handleOpenProjectsClick}
          >
            My projects
          </button>
        </div>
      </div>

      <div className={styles.consoleZone}>
        <div className={styles.consoleTitle}>Groups</div>
        <button
          type="button"
          className={styles.consoleStatus}
          onClick={() => onWorkbenchChange('groups')}
          aria-pressed={activeWorkbench === 'groups'}
        >
          <strong>{user ? `${myGroupCount} joined groups` : `${publicGroupCount} public groups`}</strong>
          <span>Music rooms for outside communities, wired into projects and collabs.</span>
        </button>
        <div className={styles.consoleMeterRow}>
          <ConsoleMeter label="mine" value={user ? myGroupCount : 0} />
          <ConsoleMeter label="public" value={publicGroupCount} />
          <ConsoleMeter label="access" value="live" />
        </div>
        <div className={styles.consoleButtonRow}>
          <button
            type="button"
            className={`${styles.consoleButton} ${activeWorkbench === 'groups' ? styles.consoleButtonActive : ''}`}
            onClick={onOpenGroupsRequest}
          >
            Groups
          </button>
          <button
            type="button"
            className={`${styles.consoleButton} ${activeWorkbench === 'groups' ? styles.consoleButtonActive : ''}`}
            onClick={onCreateGroupRequest}
          >
            Create group
          </button>
        </div>
      </div>

      <div className={styles.consoleZone}>
        <div className={styles.consoleTitle}>Explore</div>
        <button
          type="button"
          className={styles.consoleStatus}
          onClick={handleExploreClick}
          aria-pressed={activeWorkbench === 'explore'}
        >
          <strong>{activeCollabs} active collabs - {selectedTagCount || 'all'} tags</strong>
          <span>{feedModeLabel} feed is the default workbench.</span>
        </button>
        <div className={styles.consoleMeterRow}>
          <ConsoleMeter label="collabs" value={totalCollabs} />
          <ConsoleMeter label="active" value={activeCollabs} />
          <ConsoleMeter label="subs" value={totalSubmissions} />
        </div>
        <div className={styles.consoleButtonRow}>
          <button
            type="button"
            className={`${styles.consoleHomeButton} ${activeWorkbench === 'explore' ? styles.consoleButtonActive : ''}`}
            onClick={handleExploreClick}
          >
            Explore feed
          </button>
          <button
            type="button"
            className={styles.consoleButton}
            onClick={() => {
              if (user) {
                openFeedbackModal();
              } else {
                navigate('/auth');
              }
            }}
          >
            Feedback
          </button>
        </div>
      </div>
    </section>
  );
}

interface ConsoleMeterProps {
  value: number | string;
  label: string;
}

function ConsoleMeter({ value, label }: ConsoleMeterProps) {
  return (
    <div className={styles.consoleMeter}>
      <span>{label}</span>
      {typeof value === 'number' ? (
        <CountUpValue className={styles.consoleMeterValue} value={value} formatValue={formatCount} />
      ) : (
        <strong>{value}</strong>
      )}
    </div>
  );
}
