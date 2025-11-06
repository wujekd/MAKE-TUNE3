import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { DashboardService, SubmissionService, CollaborationService } from '../services';
import type { DownloadSummaryItem } from '../services/dashboardService';
import type { SubmissionCollabSummary } from '../services/submissionService';
import { useAppStore } from '../stores/appStore';
import { LoadingSpinner } from './LoadingSpinner';
import { ProjectsTab } from './ProjectsTab';
import { UserActivityListItem } from './UserActivityListItem';
import { computeStageInfo } from '../utils/stageUtils';
import './ProjectHistory.css';
import './UserActivityStyles.css';

type ActiveTab = 'projects' | 'submissions' | 'downloads' | 'moderate';

const formatDateTime = (value: number | null | undefined): string => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString();
};

export function UserActivityPanel() {
  const { user, loading: authLoading } = useAppStore(state => state.auth);

  const [activeTab, setActiveTab] = useState<ActiveTab>('projects');

  const [submissionSummaries, setSubmissionSummaries] = useState<SubmissionCollabSummary[]>([]);
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
  const [collabMeta, setCollabMeta] = useState<Record<string, {
    submissionDurationMs: number | null;
    votingDurationMs: number | null;
    publishedAtMs: number | null;
    submissionCloseAtMs: number | null;
    votingCloseAtMs: number | null;
    updatedAtMs: number | null;
  }>>({});
  const collabMetaRef = useRef(collabMeta);

  useEffect(() => {
    collabMetaRef.current = collabMeta;
  }, [collabMeta]);

  const moderationItems = useMemo(
    () =>
      moderationCollabs.map(item => ({
        id: item.id,
        name: item.name || 'untitled',
        status: 'pending moderation'
      })),
    [moderationCollabs]
  );

  const loadSubmissions = async () => {
    if (submissionsLoading || submissionsLoaded) return;
    setSubmissionsLoading(true);
    setSubmissionsError(null);
    try {
      const items = await SubmissionService.listMySubmissionCollabs();
      setSubmissionSummaries(items);
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

  useEffect(() => {
    if (!user) {
      setCollabMeta({});
      return;
    }

    const submissionActiveIds = submissionSummaries
      .filter(item => {
        if (!item || !item.collabId) return false;
        if (item.collaborationDeleted) return false;
        const key = (item.status || '').toLowerCase();
        return key === 'submission' || key === 'voting';
      })
      .map(item => item.collabId);

    const downloadActiveIds = downloadSummaries
      .filter(item => {
        if (!item || !item.collabId) return false;
        const key = (item.status || '').toLowerCase();
        return key === 'submission' || key === 'voting';
      })
      .map(item => item.collabId);

    const activeIds = Array.from(new Set([...submissionActiveIds, ...downloadActiveIds]));

    const missing = activeIds.filter(id => !collabMetaRef.current[id]);
    if (!missing.length) return;

    let cancelled = false;
    (async () => {
      const results = await Promise.all(
        missing.map(async collabId => {
          try {
            const collab = await CollaborationService.getCollaboration(collabId);
            if (!collab) return null;
            const submissionDurationMs =
              typeof collab.submissionDuration === 'number' && collab.submissionDuration > 0
                ? collab.submissionDuration * 1000
                : null;
            const votingDurationMs =
              typeof collab.votingDuration === 'number' && collab.votingDuration > 0
                ? collab.votingDuration * 1000
                : null;
            const publishedAtMs = (collab.publishedAt as any)?.toMillis
              ? (collab.publishedAt as any).toMillis()
              : null;
            const submissionCloseAtMs = (collab.submissionCloseAt as any)?.toMillis
              ? (collab.submissionCloseAt as any).toMillis()
              : null;
            const votingCloseAtMs = (collab.votingCloseAt as any)?.toMillis
              ? (collab.votingCloseAt as any).toMillis()
              : null;
            const updatedAtMs = (collab.updatedAt as any)?.toMillis
              ? (collab.updatedAt as any).toMillis()
              : null;
            return {
              collabId,
              submissionDurationMs,
              votingDurationMs,
              publishedAtMs,
              submissionCloseAtMs,
              votingCloseAtMs,
              updatedAtMs
            };
          } catch {
            return null;
          }
        })
      );

      if (cancelled) return;

      setCollabMeta(prev => {
        const next = {...prev};
        results.forEach(entry => {
          if (!entry) return;
          next[entry.collabId] = {
            submissionDurationMs: entry.submissionDurationMs,
            votingDurationMs: entry.votingDurationMs,
            publishedAtMs: entry.publishedAtMs,
            submissionCloseAtMs: entry.submissionCloseAtMs,
            votingCloseAtMs: entry.votingCloseAtMs,
            updatedAtMs: entry.updatedAtMs
          };
        });
        return next;
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [user, submissionSummaries, downloadSummaries]);

  const submissionList = useMemo(() => {
    if (!submissionSummaries.length) return [];

    return submissionSummaries.map(item => {
      const status = (item.status || '').toLowerCase();
      const isDeleted = item.collaborationDeleted;
      const collabInfo = collabMeta[item.collabId];

      const submissionCloseAt = item.submissionCloseAt ?? collabInfo?.submissionCloseAtMs ?? null;
      const votingCloseAt = item.votingCloseAt ?? collabInfo?.votingCloseAtMs ?? null;
      const submissionDurationMs =
        typeof item.submissionDurationSeconds === 'number'
          ? item.submissionDurationSeconds * 1000
          : collabInfo?.submissionDurationMs ?? null;
      const votingDurationMs =
        typeof item.votingDurationSeconds === 'number'
          ? item.votingDurationSeconds * 1000
          : collabInfo?.votingDurationMs ?? null;
      const publishedAtMs = collabInfo?.publishedAtMs ?? null;

      const rawStageInfo = isDeleted
        ? null
        : computeStageInfo({
            status,
            submissionCloseAt,
            votingCloseAt,
            submissionDurationMs,
            votingDurationMs,
            publishedAt: publishedAtMs,
            updatedAt: collabInfo?.updatedAtMs
          });

      const metaLines: string[] = [];
      if (isDeleted) {
        metaLines.push(
          item.collaborationDeletedAt
            ? `removed ${formatDateTime(item.collaborationDeletedAt)}`
            : 'collaboration removed'
        );
        if (item.storageDeletionPending) {
          metaLines.push('storage cleanup pending');
        } else if (item.storageDeletedAt) {
          metaLines.push(`files purged ${formatDateTime(item.storageDeletedAt)}`);
        } else if (item.storageDeletionError) {
          metaLines.push('storage cleanup error');
        }
      } else {
        const stageLabel =
          rawStageInfo?.label ??
          (status === 'submission'
            ? submissionCloseAt
              ? `submission ends ${formatDateTime(submissionCloseAt)}`
              : 'submission running'
            : status === 'voting'
              ? votingCloseAt
                ? `voting ends ${formatDateTime(votingCloseAt)}`
                : 'voting running'
              : status === 'completed'
                ? votingCloseAt
                  ? `completed ${formatDateTime(votingCloseAt)}`
                  : 'completed'
                : status || 'unpublished');
        if (stageLabel) {
          metaLines.push(stageLabel);
        }

        metaLines.push(
          item.submittedAt
            ? `submitted ${formatDateTime(item.submittedAt)}`
            : 'submission time unknown'
        );
      }

      let route: string | null = null;
      if (!isDeleted) {
        if (status === 'completed') {
          route = `/collab/${encodeURIComponent(item.collabId)}/completed`;
        } else if (status === 'submission') {
          route = `/collab/${encodeURIComponent(item.collabId)}/submit`;
        } else {
          route = `/collab/${encodeURIComponent(item.collabId)}`;
        }
      }

      return {
        id: `${item.collabId}-${item.mySubmissionPath}`,
        title: item.collabName || 'untitled collaboration',
        subtitle: item.projectName || 'unknown project',
        status: isDeleted ? 'deleted' : status || 'unknown',
        metaLines,
        to: route,
        disabled: isDeleted,
        stageInfo: rawStageInfo
          ? {
              status: rawStageInfo.status,
              startAt: rawStageInfo.startAt ?? null,
              endAt: rawStageInfo.endAt ?? null,
              label: rawStageInfo.label ?? undefined
            }
          : null
      };
    });
  }, [submissionSummaries, collabMeta]);

  const downloadList = useMemo(() => {
    if (!downloadSummaries.length) return [];
    return downloadSummaries.map(item => {
      const status = (item.status || '').toLowerCase();
      const meta = collabMeta[item.collabId] || null;

      const submissionCloseAt =
        item.submissionCloseAt ??
        meta?.submissionCloseAtMs ??
        null;
      const votingCloseAt =
        item.votingCloseAt ??
        meta?.votingCloseAtMs ??
        null;

      const rawStageInfo =
        status === 'submission' || status === 'voting' || status === 'completed'
          ? computeStageInfo({
              status,
              submissionCloseAt,
              votingCloseAt,
              submissionDurationMs: meta?.submissionDurationMs ?? null,
              votingDurationMs: meta?.votingDurationMs ?? null,
              publishedAt: meta?.publishedAtMs ?? null,
              updatedAt: meta?.updatedAtMs ?? null
            })
          : null;

      let route: string;
      if (status === 'completed') {
        route = `/collab/${encodeURIComponent(item.collabId)}/completed`;
      } else if (status === 'submission') {
        route = `/collab/${encodeURIComponent(item.collabId)}/submit`;
      } else {
        route = `/collab/${encodeURIComponent(item.collabId)}`;
      }

      const metaLines: string[] = [];
      const stageLabel =
        rawStageInfo?.label ??
        (status === 'submission'
          ? submissionCloseAt
            ? `submission ends ${formatDateTime(submissionCloseAt)}`
            : 'submission running'
          : status === 'voting'
            ? votingCloseAt
              ? `voting ends ${formatDateTime(votingCloseAt)}`
              : 'voting running'
            : status === 'completed'
              ? votingCloseAt
                ? `completed ${formatDateTime(votingCloseAt)}`
                : 'completed'
              : status || 'unpublished');
      if (stageLabel) {
        metaLines.push(stageLabel);
      }

      metaLines.push(
        item.lastDownloadedAt
          ? `last downloaded ${formatDateTime(item.lastDownloadedAt)} · ${item.downloadCount} download${item.downloadCount === 1 ? '' : 's'}`
          : `${item.downloadCount} download${item.downloadCount === 1 ? '' : 's'}`
      );

      return {
        id: `${item.collabId}-${item.lastDownloadedAt}`,
        title: item.collabName || 'untitled collaboration',
        subtitle: item.projectName || 'unknown project',
        status: status || 'unknown',
        metaLines,
        to: route,
        actionLabel: 'open',
        stageInfo: rawStageInfo
          ? {
              status: rawStageInfo.status,
              startAt: rawStageInfo.startAt ?? null,
              endAt: rawStageInfo.endAt ?? null,
              label: rawStageInfo.label ?? undefined
            }
          : null
      };
    });
  }, [downloadSummaries, collabMeta]);

  
  return (
    <div className="project-history user-activity">
      <div className="user-activity__tabs">
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
        <section className="user-activity__section">
          <div className="user-activity__section-header">
            <h4 className="project-history-title card__title user-activity__section-title">to moderate</h4>
          </div>
          <div className="collab-list list user-activity__list">
            {(authLoading || (user && !moderationLoaded)) && (
              <div className="user-activity__loading">
                <LoadingSpinner size={24} />
              </div>
            )}
            {!authLoading && !user && (
              <div className="user-activity__message">
                <Link to="/auth?mode=login">login</Link> to see moderation queue
              </div>
            )}
            {!authLoading && user && moderationLoaded && moderationError && (
              <div className="user-activity__message">{moderationError}</div>
            )}
            {!authLoading && user && moderationLoaded && !moderationError && moderationCollabs.length === 0 && (
              <div className="user-activity__message user-activity__message--muted">no collaborations need moderation</div>
            )}
            {!authLoading && user && moderationLoaded && moderationItems.map(item => (
              <UserActivityListItem
                key={item.id}
                title={item.name}
                subtitle="pending moderation"
                status="pending moderation"
                to={`/collab/${encodeURIComponent(item.id)}/moderate`}
                actionLabel="review"
              />
            ))}
          </div>
        </section>
      )}

      {activeTab === 'submissions' && (
        <section className="user-activity__section">
          <div className="user-activity__section-header">
            <h4 className="project-history-title card__title user-activity__section-title">my submissions</h4>
          </div>
          <div className="collab-list list user-activity__list">
            {(authLoading || (user && !submissionsLoaded)) && (
              <div className="user-activity__loading">
                <LoadingSpinner size={24} />
              </div>
            )}
            {!authLoading && !user && (
              <div className="user-activity__message">
                <Link to="/auth?mode=login">login</Link> to see submissions
              </div>
            )}
            {!authLoading && user && submissionsLoaded && submissionsError && (
              <div className="user-activity__message">{submissionsError}</div>
            )}
            {!authLoading && user && submissionsLoaded && !submissionsError && submissionSummaries.length === 0 && (
              <div className="user-activity__message user-activity__message--muted">no submissions</div>
            )}
            {!authLoading && user && submissionsLoaded && submissionList.map(item => (
              <UserActivityListItem
                key={item.id}
                title={item.title}
                subtitle={item.subtitle}
                status={item.status}
                metaLines={item.metaLines}
                to={item.to ?? undefined}
                disabled={item.disabled}
                stageInfo={item.stageInfo}
              />
            ))}
          </div>
        </section>
      )}

      {activeTab === 'downloads' && (
        <section className="user-activity__section">
          <div className="user-activity__section-header">
            <h4 className="project-history-title card__title user-activity__section-title">downloaded backings</h4>
          </div>
          <div className="collab-list list user-activity__list">
            {(authLoading || (user && !downloadsLoaded)) && (
              <div className="user-activity__loading">
                <LoadingSpinner size={24} />
              </div>
            )}
            {!authLoading && !user && (
              <div className="user-activity__message">
                <Link to="/auth?mode=login">login</Link> to see downloads
              </div>
            )}
            {!authLoading && user && downloadsLoaded && downloadsError && (
              <div className="user-activity__message">{downloadsError}</div>
            )}
            {!authLoading && user && downloadsLoaded && !downloadsError && downloadSummaries.length === 0 && (
              <div className="user-activity__message user-activity__message--muted">no downloads yet</div>
            )}
            {!authLoading && user && downloadsLoaded && downloadList.map(item => (
              <UserActivityListItem
                key={item.id}
                title={item.title}
                subtitle={item.subtitle}
                status={item.status}
                metaLines={item.metaLines}
                to={item.to}
                actionLabel={item.actionLabel}
                stageInfo={item.stageInfo}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
