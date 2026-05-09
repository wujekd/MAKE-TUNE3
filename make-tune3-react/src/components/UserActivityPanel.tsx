import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { DownloadSummaryItem } from '../services/dashboardService';
import type { SubmissionCollabSummary } from '../services/submissionService';
import { useAppStore } from '../stores/appStore';
import { LoadingSpinner } from './LoadingSpinner';
import { UserActivityListItem } from './UserActivityListItem';
import { DashboardPlaceholderItem } from './DashboardPlaceholderItem';
import { computeStageInfo } from '../utils/stageUtils';
import './ProjectHistory.css';
import './UserActivityStyles.css';

type ActiveTab = 'projects' | 'activity';

const ProjectsTab = lazy(() =>
  import('./ProjectsTab').then(module => ({ default: module.ProjectsTab }))
);

const formatDateTime = (value: number | null | undefined): string => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString();
};

export function UserActivityPanel() {
  const user = useAppStore(state => state.auth.user);
  const authLoading = useAppStore(state => state.auth.loading);
  const loadingPlaceholders = [0, 1, 2];

  const [activeTab, setActiveTab] = useState<ActiveTab>('activity');

  const [submissionSummaries, setSubmissionSummaries] = useState<SubmissionCollabSummary[]>([]);
  const [submissionsLoading, setSubmissionsLoading] = useState(false);
  const [submissionsLoaded, setSubmissionsLoaded] = useState(false);
  const [submissionsError, setSubmissionsError] = useState<string | null>(null);

  const [downloadSummaries, setDownloadSummaries] = useState<DownloadSummaryItem[]>([]);
  const [downloadsLoading, setDownloadsLoading] = useState(false);
  const [downloadsLoaded, setDownloadsLoaded] = useState(false);
  const [downloadsError, setDownloadsError] = useState<string | null>(null);
  const [projectsTabRequested, setProjectsTabRequested] = useState(false);



  const loadSubmissions = useCallback(async () => {
    if (submissionsLoading || submissionsLoaded) return;
    setSubmissionsLoading(true);
    setSubmissionsError(null);
    try {
      const { SubmissionService } = await import('../services/submissionService');
      const items = await SubmissionService.listMySubmissionCollabs();
      setSubmissionSummaries(items);
      setSubmissionsLoaded(true);
    } catch (e: any) {
      setSubmissionsError(e?.message || 'failed to load submissions');
    } finally {
      setSubmissionsLoading(false);
    }
  }, [submissionsLoading, submissionsLoaded]);

  const loadDownloads = useCallback(async () => {
    if (downloadsLoading || downloadsLoaded) return;
    setDownloadsLoading(true);
    setDownloadsError(null);
    try {
      const { DashboardService } = await import('../services/dashboardService');
      const items = await DashboardService.listMyDownloadedCollabs();
      setDownloadSummaries(items);
      setDownloadsLoaded(true);
    } catch (e: any) {
      setDownloadsError(e?.message || 'failed to load downloads');
    } finally {
      setDownloadsLoading(false);
    }
  }, [downloadsLoading, downloadsLoaded]);



  useEffect(() => {
    if (!user) {
      setSubmissionSummaries([]);
      setDownloadSummaries([]);
      setDownloadsLoaded(false);
      setSubmissionsLoaded(false);
      return;
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    if (activeTab === 'activity') {
      void loadSubmissions();
      void loadDownloads();
    }
  }, [activeTab, user, loadSubmissions, loadDownloads]);

  useEffect(() => {
    if (activeTab === 'projects') {
      setProjectsTabRequested(true);
    }
  }, [activeTab]);


  const activityList = useMemo(() => {
    if (!downloadSummaries.length) return [];

    // Create a map of submissions for quick lookup
    const submissionMap = new Map();
    submissionSummaries.forEach(sub => {
      submissionMap.set(sub.collabId, sub);
    });

    return downloadSummaries.map(item => {
      const submission = submissionMap.get(item.collabId);
      const status = (item.status || '').toLowerCase();

      const submissionCloseAt = item.submissionCloseAt ?? null;
      const votingCloseAt = item.votingCloseAt ?? null;

      const rawStageInfo =
        status === 'submission' || status === 'voting' || status === 'completed'
          ? computeStageInfo({
            status,
            submissionCloseAt,
            votingCloseAt,
            submissionDurationMs:
              typeof item.submissionDuration === 'number' && item.submissionDuration > 0
                ? item.submissionDuration * 1000
                : null,
            votingDurationMs:
              typeof item.votingDuration === 'number' && item.votingDuration > 0
                ? item.votingDuration * 1000
                : null,
            publishedAt: item.publishedAt ?? null,
            updatedAt: item.updatedAt ?? null
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

      // Download info
      metaLines.push(
        item.lastDownloadedAt
          ? `last downloaded ${formatDateTime(item.lastDownloadedAt)}`
          : `${item.downloadCount} download${item.downloadCount === 1 ? '' : 's'}`
      );

      // Submission status info
      let submissionStatusText = 'not submitted';
      if (submission) {
        if (submission.collaborationDeleted) {
          submissionStatusText = 'submission deleted';
        } else {
          submissionStatusText = 'submitted';
          if (submission.submittedAt) {
            submissionStatusText += ` ${formatDateTime(submission.submittedAt)}`;
          }
          if (submission.moderationStatus) {
            submissionStatusText += ` (${submission.moderationStatus})`;
          }
        }
        metaLines.push(submissionStatusText);
      } else {
        metaLines.push('not submitted');
      }

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
          : null,
        isSubmitted: !!submission && !submission.collaborationDeleted
      };
    });
  }, [downloadSummaries, submissionSummaries]);


  return (
    <div className="project-history user-activity">
      <div className="user-activity__tabs">
        <span
          aria-hidden="true"
          className={`user-activity__tab-slider ${activeTab === 'projects' ? 'user-activity__tab-slider--projects' : ''}`}
        />
        <button
          className={`user-activity__tab ${activeTab === 'activity' ? 'user-activity__tab--active' : ''}`}
          onClick={() => setActiveTab('activity')}
        >
          my activity
        </button>
        <button
          className={`user-activity__tab ${activeTab === 'projects' ? 'user-activity__tab--active' : ''}`}
          onClick={() => setActiveTab('projects')}
        >
          my projects
        </button>
      </div>

      {/* TODO: maek smoler */}
      {activeTab === 'projects' && projectsTabRequested && (
        <Suspense fallback={<div className="user-activity__loading"><LoadingSpinner size={24} /></div>}>
          <ProjectsTab user={user} authLoading={authLoading} />
        </Suspense>
      )}



      {activeTab === 'activity' && (
        <section className="user-activity__section">
          <div className="user-activity__section-header">
            <h4 className="project-history-title card__title user-activity__section-title">downloads & submissions</h4>
          </div>
          <div className="collab-list list user-activity__list">
            {(authLoading || (user && (!downloadsLoaded || !submissionsLoaded))) && (
              <div className="user-activity__placeholder-list dashboard-placeholder-stack">
                {loadingPlaceholders.map(index => (
                  <DashboardPlaceholderItem key={index} variant="activity" />
                ))}
              </div>
            )}
            {!authLoading && !user && (
              <div className="user-activity__message">
                <Link to="/auth?mode=login">login</Link> to see activity
              </div>
            )}
            {!authLoading && user && downloadsLoaded && downloadsError && (
              <div className="user-activity__message">{downloadsError}</div>
            )}
            {!authLoading && user && submissionsLoaded && submissionsError && (
              <div className="user-activity__message">{submissionsError}</div>
            )}
            {!authLoading && user && downloadsLoaded && !downloadsError && activityList.length === 0 && (
              <div className="user-activity__message user-activity__message--muted">no activity yet</div>
            )}
            {!authLoading && user && downloadsLoaded && !downloadsError && activityList.map(item => (
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
