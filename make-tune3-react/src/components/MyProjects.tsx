import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { DashboardService, ProjectService, SubmissionService, CollaborationService } from '../services';
import type { ProjectOverviewItem, DownloadSummaryItem } from '../services/dashboardService';
import { useAppStore } from '../stores/appStore';
import { TagInput } from './TagInput';
import { TagUtils } from '../utils/tagUtils';
import { LoadingSpinner } from './LoadingSpinner';
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

export function MyProjects() {
  const { user, loading: authLoading } = useAppStore(state => state.auth);

  const [activeTab, setActiveTab] = useState<ActiveTab>('projects');

  const [projects, setProjects] = useState<ProjectOverviewItem[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [projectsLoaded, setProjectsLoaded] = useState(false);
  const [projectsError, setProjectsError] = useState<string | null>(null);

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

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const loadProjects = async (userId: string) => {
    setProjectsLoading(true);
    setProjectsError(null);
    try {
      const items = await DashboardService.listMyProjectsOverview();
      setProjects(items);
      setProjectsLoaded(true);
    } catch (e: any) {
      console.error('failed to load projects overview', e);
      try {
        const fallback = await ProjectService.listUserProjects(userId);
        const normalized: ProjectOverviewItem[] = fallback.map((p) => ({
          projectId: p.id,
          projectName: p.name,
          description: p.description,
          createdAt: (p.createdAt as any)?.toMillis ? (p.createdAt as any).toMillis() : null,
          updatedAt: (p.updatedAt as any)?.toMillis ? (p.updatedAt as any).toMillis() : null,
          currentCollaboration: null,
        }));
        setProjects(normalized);
        setProjectsLoaded(true);
        const friendlyMessage = e?.message || 'failed to load projects overview';
        setProjectsError(`${friendlyMessage}. Showing basic project info.`);
      } catch (fallbackErr: any) {
        console.error('failed to load fallback projects', fallbackErr);
        setProjectsError(fallbackErr?.message || 'failed to load projects');
        setProjectsLoaded(true);
      }
    } finally {
      setProjectsLoading(false);
    }
  };

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
      setProjects([]);
      setSubmissionSummaries([]);
      setDownloadSummaries([]);
      setModerationCollabs([]);
      setProjectsLoaded(false);
      setDownloadsLoaded(false);
      setSubmissionsLoaded(false);
      setModerationLoaded(false);
      return;
    }
    void loadProjects(user.uid);
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

      {activeTab === 'projects' && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h4 className="project-history-title card__title" style={{ marginBottom: 0 }}>my projects</h4>
            <button
              style={{
                marginLeft: 8,
                padding: '6px 10px',
                borderRadius: 6,
                border: '1px solid var(--border-color, #333)',
                background: 'var(--primary1-700)',
                color: 'var(--white)',
                opacity: user && !authLoading ? 1 : 0.6,
                cursor: user && !authLoading ? 'pointer' : 'not-allowed'
              }}
              disabled={!user || authLoading}
              onClick={() => setShowForm(v => !v)}
            >
              + create project
            </button>
          </div>
          <div className="collab-list list" style={{ marginTop: 8, flex: 1, minHeight: 0, overflowY: 'auto' }}>
            {showForm && (
              <div className="collab-history-item list__item" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
                <input
                  placeholder="project name"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  disabled={!user || saving}
                  style={{ padding: 8, borderRadius: 6, border: '1px solid var(--primary1-800)', background: 'var(--primary1-800)', color: 'var(--white)' }}
                />
                <textarea
                  placeholder="description (optional)"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  disabled={!user || saving}
                  rows={3}
                  style={{ padding: 8, borderRadius: 6, border: '1px solid var(--primary1-800)', background: 'var(--primary1-800)', color: 'var(--white)', resize: 'vertical' }}
                />
                <TagInput
                  tags={tags}
                  onChange={setTags}
                  disabled={saving}
                  placeholder="Add tags..."
                />
                {formError && <div style={{ color: 'var(--white)' }}>{formError}</div>}
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => { setShowForm(false); setName(''); setDescription(''); setTags([]); setFormError(null); }}
                    disabled={saving}
                  >
                    cancel
                  </button>
                  <button
                    onClick={async () => {
                      if (!user) return;
                      const trimmed = name.trim();
                      if (!trimmed) { setFormError('name required'); return; }
                      if (trimmed.length > 80) { setFormError('name too long'); return; }
                      if (description.length > 500) { setFormError('description too long'); return; }

                      const normalized = TagUtils.normalizeTags(tags);

                      setSaving(true); setFormError(null);
                      try {
                        await ProjectService.createProjectWithUniqueName({
                          name: trimmed,
                          description,
                          ownerId: user.uid,
                          tags: normalized.display,
                          tagsKey: normalized.keys
                        });
                        setShowForm(false); setName(''); setDescription(''); setTags([]);
                        await loadProjects(user.uid);
                      } catch (e: any) {
                        const msg = e?.message || 'failed to create';
                        if (/name already taken/i.test(msg)) {
                          setFormError('Name already taken. Please choose a different name.');
                        } else {
                          setFormError(msg);
                        }
                      } finally {
                        setSaving(false);
                      }
                    }}
                    disabled={!user || saving}
                  >
                    {saving ? 'creating...' : 'create'}
                  </button>
                </div>
              </div>
            )}
            {(authLoading || (user && !projectsLoaded)) && (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '2rem' }}>
                <LoadingSpinner size={24} />
              </div>
            )}
            {!authLoading && !user && (
              <div style={{ color: 'var(--white)' }}>
                <Link to="/auth?mode=login" style={{ color: 'var(--contrast-600)', textDecoration: 'underline' }}>login</Link> to see your projects
              </div>
            )}
            {!authLoading && user && projectsLoaded && projectsError && <div style={{ color: 'var(--white)' }}>{projectsError}</div>}
            {!authLoading && user && projectsLoaded && !projectsError && projects.length === 0 && (
              <div style={{ color: 'var(--white)' }}>no projects</div>
            )}
            {!authLoading && user && projectsLoaded && projects.map(project => (
              <Link key={project.projectId} to={`/project/${project.projectId}`} className="collab-history-item list__item" style={{ textDecoration: 'none' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <div className="collab-name list__title">{project.projectName}</div>
                  <div className="collab-stage list__subtitle">created {formatDateTime(project.createdAt)}</div>
                  {project.currentCollaboration ? (
                    <div style={{ fontSize: 12, opacity: 0.75 }}>
                      current: {project.currentCollaboration.name} · {formatCountdownLabel(project.currentCollaboration.status, project.currentCollaboration.submissionCloseAt, project.currentCollaboration.votingCloseAt)}
                    </div>
                  ) : (
                    <div style={{ fontSize: 12, opacity: 0.6 }}>no active collaboration</div>
                  )}
                </div>
                <span
                  style={{
                    marginLeft: 'auto',
                    padding: '4px 8px',
                    borderRadius: 6,
                    border: '1px solid var(--border-color, #333)',
                    background: 'var(--primary1-800)',
                    color: 'var(--white)'
                  }}
                >
                  manage
                </span>
              </Link>
            ))}
      </div>
    </>
  )}

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
              <Link key={item.id} to={`/collab/${encodeURIComponent(item.id)}/moderate`} className="collab-history-item list__item" style={{ textDecoration: 'none' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span className="collab-name list__title">{item.name}</span>
                  <span className="collab-stage list__subtitle">pending moderation</span>
                </div>
                <span
                  style={{
                    marginLeft: 'auto',
                    padding: '4px 8px',
                    borderRadius: 6,
                    border: '1px solid var(--border-color, #333)',
                    background: 'var(--primary1-800)',
                    color: 'var(--white)'
                  }}
                >
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
                <Link key={`${item.collabId}-${item.mySubmissionPath}`} to={route} className="collab-history-item list__item" style={{ textDecoration: 'none' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span className="collab-name list__title">{item.collabName}</span>
                    <span className="collab-stage list__subtitle">{item.projectName}</span>
                    <span style={{ fontSize: 12, opacity: 0.75 }}>{formatCountdownLabel(status, item.submissionCloseAt, item.votingCloseAt)}</span>
                    <span style={{ fontSize: 12, opacity: 0.6 }}>submitted {formatDateTime(item.submittedAt)}</span>
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
                <Link key={`${item.collabId}-${item.lastDownloadedAt}`} to={route} className="collab-history-item list__item" style={{ textDecoration: 'none' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span className="collab-name list__title">{item.collabName}</span>
                    <span className="collab-stage list__subtitle">{item.projectName}</span>
                    <span style={{ fontSize: 12, opacity: 0.75 }}>{formatCountdownLabel(status, item.submissionCloseAt, item.votingCloseAt)}</span>
                    <span style={{ fontSize: 12, opacity: 0.6 }}>last downloaded {formatDateTime(item.lastDownloadedAt)} · {item.downloadCount} download{item.downloadCount === 1 ? '' : 's'}</span>
                  </div>
                  <span
                    style={{
                      marginLeft: 'auto',
                      padding: '4px 8px',
                      borderRadius: 6,
                      border: '1px solid var(--border-color, #333)',
                      background: 'var(--primary1-800)',
                      color: 'var(--white)'
                    }}
                  >
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
