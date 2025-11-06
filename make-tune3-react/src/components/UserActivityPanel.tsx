import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { DashboardService, SubmissionService, CollaborationService } from '../services';
import type { DownloadSummaryItem } from '../services/dashboardService';
import { useAppStore } from '../stores/appStore';
import { LoadingSpinner } from './LoadingSpinner';
import { ProjectsTab } from './ProjectsTab';
import './ProjectHistory.css';

type SubmissionSummaryItem = {
  projectId: string;
  projectName: string;
  collabId: string;
  collabName: string;
  status: string;
  submissionCloseAt: number | null;
  votingCloseAt: number | null;
  backingPath: string;
  mySubmissionPath: string;
  winnerPath: string | null;
  submittedAt: number | null;
};

type ActiveTab = 'projects' | 'submissions' | 'downloads' | 'moderate';

const formatDateTime = (value: number | null | undefined): string => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString();
};

const formatCountdownLabel = (
  status: string,
  submissionCloseAt: number | null,
  votingCloseAt: number | null
): string => {
  if (status === 'submission') {
    return submissionCloseAt ? `submission ends ${formatDateTime(submissionCloseAt)}` : 'submission running';
  }
  if (status === 'voting') {
    return votingCloseAt ? `voting ends ${formatDateTime(votingCloseAt)}` : 'voting running';
  }
  if (status === 'completed') {
    return votingCloseAt ? `completed ${formatDateTime(votingCloseAt)}` : 'completed';
  }
  return status || 'unpublished';
};

export function UserActivityPanel() {
  const { user, loading: authLoading } = useAppStore(state => state.auth);

  const [activeTab, setActiveTab] = useState<ActiveTab>('projects');

  const [submissionSummaries, setSubmissionSummaries] = useState<SubmissionSummaryItem[]>([]);
  const [submissionsLoading, setSubmissionsLoading] = useState(false);
  const [submissionsLoaded, setSubmissionsLoaded] = useState(false);
  const [submissionsError, setSubmissionsError] = useState<string | null>(null);

  const [downloadSummaries, setDownloadSummaries] = useState<DownloadSummaryItem[]>([]);
  const [downloadsLoading, setDownloadsLoading] = useState(false);
  const [downloadsLoaded, setDownloadsLoaded] = useState(false);
  const [downloadsError, setDownloadsError] = useState<string | null>(null);
  const [moderationCollabs, setModerationCollabs] = useState<Array<{ id: string; name: string }>>([]);
  const [moderationLoading, setModerationLoading] = useState(false);
  const [moderationLoaded, setModerationLoaded] = useState(false);
  const [moderationError, setModerationError] = useState<string | null>(null);

  const loadSubmissions = async () => {
    if (submissionsLoading || submissionsLoaded) return;
    setSubmissionsLoading(true);
    setSubmissionsError(null);
    try {
      const items = await SubmissionService.listMySubmissionCollabs();
      setSubmissionSummaries(items as SubmissionSummaryItem[]);
      setSubmissionsLoaded(true);
    } catch (e: any) {
      setSubmissionsError(e?.message || 'failed to load submissions');
    } finally {
      setSubmissionsLoading(false);
    }
  };

  const loadDownloads = async () => {
    if (downloadsLoading || downloadsLoaded) return;
    setDownloadsLoading(true);
    setDownloadsError(null);
    try {
      const items = await DashboardService.listMyDownloadedCollabs();
      setDownloadSummaries(items);
      setDownloadsLoaded(true);
    } catch (e: any) {
      setDownloadsError(e?.message || 'failed to load downloads');
    } finally {
      setDownloadsLoading(false);
    }
  };

  const loadModeration = async () => {
    if (moderationLoading || moderationLoaded) return;
    setModerationLoading(true);
    setModerationError(null);
    try {
      const all = await CollaborationService.listAllCollaborations();
      const filtered = all.filter(collab => {
        const requiresMod = Boolean((collab as any).requiresModeration);
        const hasPending = Boolean((collab as any).unmoderatedSubmissions);
        return requiresMod && hasPending;
      });
      const normalized = filtered.map(collab => ({
        id: collab.id,
        name: collab.name || 'untitled'
      }));
      setModerationCollabs(normalized);
      setModerationLoaded(true);
    } catch (e: any) {
      setModerationError(e?.message || 'failed to load moderation queue');
    } finally {
      setModerationLoading(false);
    }
  };

  useEffect(() => {
    if (!user) {
      setSubmissionSummaries([]);
      setDownloadSummaries([]);
      setModerationCollabs([]);
      setDownloadsLoaded(false);
      setSubmissionsLoaded(false);
      setModerationLoaded(false);
      return;
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    if (activeTab === 'submissions') {
      void loadSubmissions();
    } else if (activeTab === 'downloads') {
      void loadDownloads();
    } else if (activeTab === 'moderate') {
      void loadModeration();
    }
  }, [activeTab, user]);

  return (
    <div
      className="project-history"
      style={{ minWidth: 0, maxWidth: 'none', width: '100%', height: 'auto', display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1, overflow: 'hidden' }}
    >
      <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
        <button onClick={() => setActiveTab('projects')} disabled={activeTab === 'projects'}>
          my projects
        </button>
        <button onClick={() => setActiveTab('submissions')} disabled={activeTab === 'submissions'}>
          my submissions
        </button>
        <button onClick={() => setActiveTab('downloads')} disabled={activeTab === 'downloads'}>
          my downloads
        </button>
        <button onClick={() => setActiveTab('moderate')} disabled={activeTab === 'moderate'}>
          to moderate
        </button>
      </div>

{/* TODO: maek smoler */}
      {activeTab === 'projects' && <ProjectsTab user={user} authLoading={authLoading} />}

      {activeTab === 'moderate' && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h4 className="project-history-title card__title" style={{ marginBottom: 0 }}>to moderate</h4>
          </div>
          <div className="collab-list list" style={{ marginTop: 8, flex: 1, minHeight: 0, overflowY: 'auto' }}>
            {(authLoading || (user && !moderationLoaded)) && (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '2rem' }}>
                <LoadingSpinner size={24} />
              </div>
            )}
            {!authLoading && !user && (
              <div style={{ color: 'var(--white)' }}>
                <Link to="/auth?mode=login" style={{ color: 'var(--contrast-600)', textDecoration: 'underline' }}>login</Link> to see moderation queue
              </div>
            )}
            {!authLoading && user && moderationLoaded && moderationError && <div style={{ color: 'var(--white)' }}>{moderationError}</div>}
            {!authLoading && user && moderationLoaded && !moderationError && moderationCollabs.length === 0 && (
              <div style={{ color: 'var(--white)' }}>no collaborations need moderation</div>
            )}
            {!authLoading && user && moderationLoaded && moderationCollabs.map(item => (
              <Link key={item.id} to={`/collab/${encodeURIComponent(item.id)}/moderate`} className="user-activity-list-item">
                <div className="user-activity-list-item__content">
                  <span className="user-activity-list-item__title">{item.name}</span>
                  <span className="user-activity-list-item__subtitle">pending moderation</span>
                </div>
                <span className="user-activity-list-item__action">
                  review
                </span>
              </Link>
            ))}
          </div>
        </>
      )}

      {activeTab === 'submissions' && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h4 className="project-history-title card__title" style={{ marginBottom: 0 }}>my submissions</h4>
          </div>
          <div className="collab-list list" style={{ marginTop: 8, flex: 1, minHeight: 0, overflowY: 'auto' }}>
            {(authLoading || (user && !submissionsLoaded)) && (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '2rem' }}>
                <LoadingSpinner size={24} />
              </div>
            )}
            {!authLoading && !user && (
              <div style={{ color: 'var(--white)' }}>
                <Link to="/auth?mode=login" style={{ color: 'var(--contrast-600)', textDecoration: 'underline' }}>login</Link> to see submissions
              </div>
            )}
            {!authLoading && user && submissionsLoaded && submissionsError && <div style={{ color: 'var(--white)' }}>{submissionsError}</div>}
            {!authLoading && user && submissionsLoaded && !submissionsError && submissionSummaries.length === 0 && (
              <div style={{ color: 'var(--white)' }}>no submissions</div>
            )}
            {!authLoading && user && submissionsLoaded && submissionSummaries.map(item => {
              const status = item.status || 'unknown';
              const route = status === 'completed'
                ? `/collab/${encodeURIComponent(item.collabId)}/completed`
                : status === 'submission'
                  ? `/collab/${encodeURIComponent(item.collabId)}/submit`
                  : `/collab/${encodeURIComponent(item.collabId)}`;
              return (
                <Link key={`${item.collabId}-${item.mySubmissionPath}`} to={route} className="user-activity-list-item">
                  <div className="user-activity-list-item__content">
                    <span className="user-activity-list-item__title">{item.collabName}</span>
                    <span className="user-activity-list-item__subtitle">{item.projectName}</span>
                    <span className="user-activity-list-item__meta">{formatCountdownLabel(status, item.submissionCloseAt, item.votingCloseAt)}</span>
                    <span className="user-activity-list-item__meta user-activity-list-item__meta--muted">submitted {formatDateTime(item.submittedAt)}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </>
      )}

      {activeTab === 'downloads' && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h4 className="project-history-title card__title" style={{ marginBottom: 0 }}>downloaded backings</h4>
          </div>
          <div className="collab-list list" style={{ marginTop: 8, flex: 1, minHeight: 0, overflowY: 'auto' }}>
            {(authLoading || (user && !downloadsLoaded)) && (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '2rem' }}>
                <LoadingSpinner size={24} />
              </div>
            )}
            {!authLoading && !user && (
              <div style={{ color: 'var(--white)' }}>
                <Link to="/auth?mode=login" style={{ color: 'var(--contrast-600)', textDecoration: 'underline' }}>login</Link> to see downloads
              </div>
            )}
            {!authLoading && user && downloadsLoaded && downloadsError && <div style={{ color: 'var(--white)' }}>{downloadsError}</div>}
            {!authLoading && user && downloadsLoaded && !downloadsError && downloadSummaries.length === 0 && (
              <div style={{ color: 'var(--white)' }}>no downloads yet</div>
            )}
            {!authLoading && user && downloadsLoaded && downloadSummaries.map(item => {
              const status = item.status || 'unknown';
              const route = status === 'completed'
                ? `/collab/${encodeURIComponent(item.collabId)}/completed`
                : status === 'submission'
                  ? `/collab/${encodeURIComponent(item.collabId)}/submit`
                  : `/collab/${encodeURIComponent(item.collabId)}`;
              return (
                <Link key={`${item.collabId}-${item.lastDownloadedAt}`} to={route} className="user-activity-list-item">
                  <div className="user-activity-list-item__content">
                    <span className="user-activity-list-item__title">{item.collabName}</span>
                    <span className="user-activity-list-item__subtitle">{item.projectName}</span>
                    <span className="user-activity-list-item__meta">{formatCountdownLabel(status, item.submissionCloseAt, item.votingCloseAt)}</span>
                    <span className="user-activity-list-item__meta user-activity-list-item__meta--muted">last downloaded {formatDateTime(item.lastDownloadedAt)} · {item.downloadCount} download{item.downloadCount === 1 ? '' : 's'}</span>
                  </div>
                  <span className="user-activity-list-item__action">
                    open
                  </span>
                </Link>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}