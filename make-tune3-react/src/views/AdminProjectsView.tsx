import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AdminService, CollaborationService, ProjectService } from '../services';
import type { AdminCollaborationSummary, AdminProjectWithCollabs } from '../services/adminService';
import { AdminLayout } from '../components/AdminLayout';
import { useAppStore } from '../stores/appStore';
import './AdminProjectsView.css';

type StageDateField = 'submissionCloseAt' | 'votingCloseAt';
type StageDateSource = 'saved' | 'estimated' | 'missing';

const statusLabel = (status: string) => {
  const normalized = String(status || 'unknown').replace(/[_-]/g, ' ');
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
};

const formatDate = (millis: number | null) => {
  if (!millis) return 'Not set';
  const date = new Date(millis);
  if (Number.isNaN(date.getTime())) return 'Not set';
  return date.toLocaleString();
};

const formatDuration = (seconds: number | null) => {
  if (!seconds || seconds <= 0) return 'Not set';
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  if (days > 0 && hours > 0) return `${days}d ${hours}h`;
  if (days > 0) return `${days}d`;
  if (hours > 0) return `${hours}h`;
  return `${Math.floor(seconds / 60)}m`;
};

const formatDateInput = (millis: number | null) => {
  if (!millis) return '';
  const date = new Date(millis);
  if (Number.isNaN(date.getTime())) return '';
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
};

const parseDateInput = (value: string) => {
  if (!value) return null;
  const millis = new Date(value).getTime();
  return Number.isFinite(millis) ? millis : null;
};

const fieldLabel = (field: StageDateField) =>
  field === 'submissionCloseAt' ? 'Submission ends' : 'Voting ends';

const addSeconds = (millis: number | null, seconds: number | null) => {
  if (!millis || !seconds || seconds <= 0) return null;
  return millis + seconds * 1000;
};

const getSubmissionEnd = (collab: AdminCollaborationSummary) =>
  collab.submissionCloseAt ?? addSeconds(collab.publishedAt, collab.submissionDuration);

const getVotingEnd = (collab: AdminCollaborationSummary) => {
  if (collab.votingCloseAt) return collab.votingCloseAt;
  const submissionEnd = getSubmissionEnd(collab);
  return addSeconds(submissionEnd ?? collab.publishedAt, collab.votingDuration);
};

const getStageDateValue = (collab: AdminCollaborationSummary, field: StageDateField) =>
  field === 'submissionCloseAt' ? getSubmissionEnd(collab) : getVotingEnd(collab);

const getStageDateSource = (collab: AdminCollaborationSummary, field: StageDateField): StageDateSource => {
  if (collab[field]) return 'saved';
  return getStageDateValue(collab, field) ? 'estimated' : 'missing';
};

const getActiveDeadline = (collab: AdminCollaborationSummary) => {
  if (collab.status === 'submission') return getSubmissionEnd(collab);
  if (collab.status === 'voting') return getVotingEnd(collab);
  return null;
};

export function AdminProjectsView() {
  const [items, setItems] = useState<AdminProjectWithCollabs[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionTarget, setActionTarget] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [dateDrafts, setDateDrafts] = useState<Record<string, string>>({});

  const [pageTokens, setPageTokens] = useState<(string | null)[]>([null]);
  const [currentPage, setCurrentPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  const navigate = useNavigate();
  const user = useAppStore(state => state.auth.user);

  useEffect(() => {
    void loadProjects(0, [null]);
  }, []);

  const loadProjects = async (page: number, tokens: (string | null)[]) => {
    setLoading(true);
    setError(null);
    try {
      const result = await AdminService.listProjects(25, tokens[page] ?? null);
      setItems(result.items);
      setHasMore(result.hasMore);
      setDateDrafts({});

      const newTokens = [...tokens];
      if (result.nextPageToken) {
        newTokens[page + 1] = result.nextPageToken;
      }
      setPageTokens(newTokens);
      setCurrentPage(page);
    } catch (err: any) {
      setError(err?.message || 'Failed to load admin data');
    } finally {
      setLoading(false);
    }
  };

  const summary = useMemo(() => {
    const collaborations = items.flatMap(item => item.collaborations || []);
    return {
      projects: items.length,
      collaborations: collaborations.length,
      active: collaborations.filter(collab => ['submission', 'voting'].includes(collab.status)).length,
      unpublished: collaborations.filter(collab => collab.status === 'unpublished').length,
      submissions: collaborations.reduce((sum, collab) => sum + (collab.submissionsCount || 0), 0),
      votes: collaborations.reduce((sum, collab) => sum + (collab.votesCount || 0), 0)
    };
  }, [items]);

  const goToPage = (page: number) => {
    if (page < 0) return;
    void loadProjects(page, pageTokens);
  };

  const handleEditProject = (projectId: string) => {
    navigate(`/project/${projectId}`);
  };

  const handleEditCollaboration = (projectId: string, collaborationId: string) => {
    navigate(`/project/${projectId}?collab=${collaborationId}`);
  };

  const handleDateDraftChange = (collabId: string, field: StageDateField, value: string) => {
    setDateDrafts(prev => ({
      ...prev,
      [`${collabId}:${field}`]: value
    }));
  };

  const handleSaveStageDate = async (
    projectId: string,
    collab: AdminCollaborationSummary,
    field: StageDateField
  ) => {
    const draftKey = `${collab.id}:${field}`;
    const rawValue = dateDrafts[draftKey] ?? formatDateInput(getStageDateValue(collab, field));
    const nextMillis = parseDateInput(rawValue);
    if (!nextMillis) {
      setActionError(`${fieldLabel(field)} needs a valid date and time.`);
      return;
    }

    const siblingEnd = field === 'submissionCloseAt' ? getVotingEnd(collab) : getSubmissionEnd(collab);
    if (field === 'submissionCloseAt' && siblingEnd && nextMillis > siblingEnd) {
      setActionError('Submission end must be before voting end.');
      return;
    }
    if (field === 'votingCloseAt' && siblingEnd && nextMillis < siblingEnd) {
      setActionError('Voting end must be after submission end.');
      return;
    }

    setActionTarget(`date:${collab.id}:${field}`);
    setActionError(null);
    try {
      await AdminService.updateCollaborationStageDates(collab.id, { [field]: nextMillis });
      setItems(prev => prev.map(item => {
        if (item.project.id !== projectId) return item;
        return {
          ...item,
          collaborations: item.collaborations.map(existing =>
            existing.id === collab.id
              ? { ...existing, [field]: nextMillis, updatedAt: Date.now() }
              : existing
          )
        };
      }));
      setDateDrafts(prev => {
        const next = { ...prev };
        delete next[draftKey];
        return next;
      });
    } catch (err: any) {
      setActionError(err?.message || 'Failed to update stage date');
    } finally {
      setActionTarget(null);
    }
  };

  const handleDeleteCollaboration = async (projectId: string, collaborationId: string) => {
    const item = items.find(i => i.project.id === projectId);
    const collab = item?.collaborations.find(c => c.id === collaborationId);
    const label = collab?.name || collaborationId;
    const confirmed = window.confirm(`Delete collaboration "${label}"? This cannot be undone.`);
    if (!confirmed) return;

    setActionTarget(`collab:${collaborationId}`);
    setActionError(null);
    try {
      await CollaborationService.deleteCollaboration(collaborationId);
      setItems(prev => prev.map(it => {
        if (it.project.id !== projectId) return it;
        return {
          ...it,
          collaborations: it.collaborations.filter(c => c.id !== collaborationId)
        };
      }));
    } catch (err: any) {
      setActionError(err?.message || 'Failed to delete collaboration');
    } finally {
      setActionTarget(null);
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    const item = items.find(i => i.project.id === projectId);
    const label = item?.project.name || projectId;
    const relatedCollabs = item?.collaborations || [];

    const confirmed = window.confirm(
      relatedCollabs.length > 0
        ? `Delete project "${label}" and its ${relatedCollabs.length} collaboration(s)? This cannot be undone.`
        : `Delete project "${label}"? This cannot be undone.`
    );
    if (!confirmed) return;

    setActionTarget(`project:${projectId}`);
    setActionError(null);
    try {
      for (const collab of relatedCollabs) {
        await CollaborationService.deleteCollaboration(collab.id);
      }
      await ProjectService.deleteProject(projectId);
      if (user?.uid && item?.project.ownerId === user.uid) {
        try {
          const ownerProjects = await ProjectService.listUserProjects(user.uid);
          useAppStore.setState(state => ({
            auth: {
              ...state.auth,
              user: state.auth.user ? {
                ...state.auth.user,
                projectCount: ownerProjects.length
              } : null
            }
          }));
        } catch (err) {
          console.warn('Failed to refresh project count after delete', err);
        }
      }
      setItems(prev => prev.filter(it => it.project.id !== projectId));
    } catch (err: any) {
      setActionError(err?.message || 'Failed to delete project');
    } finally {
      setActionTarget(null);
    }
  };

  return (
    <AdminLayout title="Projects & Collaborations">
      <div className="admin-projects">
        <section className="admin-projects__summary" aria-label="Project admin summary">
          <SummaryStat label="Projects" value={summary.projects} />
          <SummaryStat label="Collaborations" value={summary.collaborations} />
          <SummaryStat label="Active stages" value={summary.active} />
          <SummaryStat label="Unpublished" value={summary.unpublished} />
          <SummaryStat label="Submissions" value={summary.submissions} />
          <SummaryStat label="Votes" value={summary.votes} />
        </section>

        <div className="admin-projects__toolbar">
          <span>
            {loading
              ? 'Loading project data...'
              : `Page ${currentPage + 1} · ${summary.projects} project(s), ${summary.collaborations} collaboration(s)`}
          </span>
          <div className="admin-projects__pager">
            <button onClick={() => goToPage(currentPage - 1)} disabled={currentPage === 0 || loading}>
              Previous
            </button>
            <button onClick={() => goToPage(currentPage + 1)} disabled={!hasMore || loading}>
              Next
            </button>
          </div>
        </div>

        {error && <div className="admin-projects__alert">{error}</div>}
        {actionError && <div className="admin-projects__alert">{actionError}</div>}

        <div className="admin-projects__list">
          {items.map(({ project, collaborations }) => {
            const projectLoading = actionTarget === `project:${project.id}`;
            const activeCollabs = collaborations.filter(collab => ['submission', 'voting'].includes(collab.status));
            const totalSubmissions = collaborations.reduce((sum, collab) => sum + (collab.submissionsCount || 0), 0);
            const totalVotes = collaborations.reduce((sum, collab) => sum + (collab.votesCount || 0), 0);

            return (
              <article key={project.id} className="admin-project-card">
                <header className="admin-project-card__header">
                  <div className="admin-project-card__title">
                    <span className="admin-project-card__eyebrow">Project</span>
                    <h3>{project.name || 'Untitled project'}</h3>
                    {project.description && <p>{project.description}</p>}
                  </div>
                  <div className="admin-project-card__actions">
                    <button onClick={() => handleEditProject(project.id)}>Open project</button>
                    <button
                      className="admin-projects__danger"
                      onClick={() => handleDeleteProject(project.id)}
                      disabled={projectLoading}
                    >
                      {projectLoading ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                </header>

                <dl className="admin-project-card__meta">
                  <MetaItem label="Owner" value={project.ownerId || 'Unknown'} />
                  <MetaItem label="Project ID" value={project.id} mono />
                  <MetaItem label="Created" value={formatDate(project.createdAt)} />
                  <MetaItem label="Updated" value={formatDate(project.updatedAt)} />
                  <MetaItem label="Active collaborations" value={String(activeCollabs.length)} />
                  <MetaItem label="Activity" value={`${totalSubmissions} submissions · ${totalVotes} votes`} />
                </dl>

                {project.tags && project.tags.length > 0 && (
                  <div className="admin-projects__tags" aria-label="Project tags">
                    {project.tags.map((tag, index) => (
                      <span key={`${project.id}-tag-${index}`}>{tag}</span>
                    ))}
                  </div>
                )}

                <section className="admin-project-card__collabs">
                  <div className="admin-project-card__section-heading">
                    <h4>Collaborations</h4>
                    <span>{collaborations.length} total</span>
                  </div>

                  {collaborations.length === 0 ? (
                    <div className="admin-projects__empty">No collaborations linked to this project.</div>
                  ) : (
                    <div className="admin-collab-list">
                      {collaborations.map(collab => (
                        <CollaborationAdminRow
                          key={collab.id}
                          collab={collab}
                          projectId={project.id}
                          actionTarget={actionTarget}
                          dateDrafts={dateDrafts}
                          onDateDraftChange={handleDateDraftChange}
                          onSaveStageDate={handleSaveStageDate}
                          onEdit={handleEditCollaboration}
                          onDelete={handleDeleteCollaboration}
                        />
                      ))}
                    </div>
                  )}
                </section>
              </article>
            );
          })}
        </div>

        {!loading && items.length === 0 && !error && (
          <div className="admin-projects__empty">No projects found.</div>
        )}
      </div>
    </AdminLayout>
  );
}

function SummaryStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="admin-projects__stat">
      <span>{label}</span>
      <strong>{value.toLocaleString()}</strong>
    </div>
  );
}

function MetaItem({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd className={mono ? 'admin-projects__mono' : undefined}>{value}</dd>
    </div>
  );
}

function CollaborationAdminRow({
  collab,
  projectId,
  actionTarget,
  dateDrafts,
  onDateDraftChange,
  onSaveStageDate,
  onEdit,
  onDelete
}: {
  collab: AdminCollaborationSummary;
  projectId: string;
  actionTarget: string | null;
  dateDrafts: Record<string, string>;
  onDateDraftChange: (collabId: string, field: StageDateField, value: string) => void;
  onSaveStageDate: (projectId: string, collab: AdminCollaborationSummary, field: StageDateField) => void;
  onEdit: (projectId: string, collaborationId: string) => void;
  onDelete: (projectId: string, collaborationId: string) => void;
}) {
  const activeDeadline = getActiveDeadline(collab);
  const collabLoading = actionTarget === `collab:${collab.id}`;
  const statusClass = `admin-collab__status admin-collab__status--${collab.status || 'unknown'}`;

  return (
    <article className="admin-collab">
      <div className="admin-collab__main">
        <div className="admin-collab__heading">
          <span className={statusClass}>{statusLabel(collab.status)}</span>
          <h5>{collab.name || 'Untitled collaboration'}</h5>
          {activeDeadline && <span className="admin-collab__deadline">Current stage ends {formatDate(activeDeadline)}</span>}
        </div>
        {collab.description && <p className="admin-collab__description">{collab.description}</p>}

        <dl className="admin-collab__meta">
          <MetaItem label="Created" value={formatDate(collab.createdAt)} />
          <MetaItem label="Published" value={formatDate(collab.publishedAt)} />
          <MetaItem label="Completed" value={formatDate(collab.completedAt)} />
          <MetaItem label="Visibility" value={collab.visibility || 'listed'} />
          <MetaItem label="Submit access" value={collab.submitAccess || 'logged_in'} />
          <MetaItem label="Vote access" value={collab.voteAccess || 'logged_in'} />
          <MetaItem label="Activity" value={`${collab.submissionsCount} submissions · ${collab.votesCount} votes`} />
          <MetaItem label="Signals" value={`${collab.favoritesCount} favorites · ${collab.participantCount} participants`} />
        </dl>

        <div className="admin-collab__stages">
          <StageEditor
            collab={collab}
            field="submissionCloseAt"
            duration={collab.submissionDuration}
            actionTarget={actionTarget}
            dateDrafts={dateDrafts}
            onDateDraftChange={onDateDraftChange}
            onSave={() => onSaveStageDate(projectId, collab, 'submissionCloseAt')}
          />
          <StageEditor
            collab={collab}
            field="votingCloseAt"
            duration={collab.votingDuration}
            actionTarget={actionTarget}
            dateDrafts={dateDrafts}
            onDateDraftChange={onDateDraftChange}
            onSave={() => onSaveStageDate(projectId, collab, 'votingCloseAt')}
          />
        </div>

        {collab.tags && collab.tags.length > 0 && (
          <div className="admin-projects__tags" aria-label="Collaboration tags">
            {collab.tags.map((tag, index) => (
              <span key={`${collab.id}-tag-${index}`}>{tag}</span>
            ))}
          </div>
        )}
      </div>

      <div className="admin-collab__actions">
        <button onClick={() => onEdit(projectId, collab.id)}>Edit</button>
        <button
          className="admin-projects__danger"
          onClick={() => onDelete(projectId, collab.id)}
          disabled={collabLoading}
        >
          {collabLoading ? 'Deleting...' : 'Delete'}
        </button>
      </div>
    </article>
  );
}

function StageEditor({
  collab,
  field,
  duration,
  actionTarget,
  dateDrafts,
  onDateDraftChange,
  onSave
}: {
  collab: AdminCollaborationSummary;
  field: StageDateField;
  duration: number | null;
  actionTarget: string | null;
  dateDrafts: Record<string, string>;
  onDateDraftChange: (collabId: string, field: StageDateField, value: string) => void;
  onSave: () => void;
}) {
  const draftKey = `${collab.id}:${field}`;
  const displayedMillis = getStageDateValue(collab, field);
  const source = getStageDateSource(collab, field);
  const currentValue = formatDateInput(displayedMillis);
  const value = dateDrafts[draftKey] ?? currentValue;
  const isDirty = value !== currentValue;
  const saving = actionTarget === `date:${collab.id}:${field}`;
  const sourceLabel = source === 'estimated' ? 'Estimated current value' : 'Current value';
  const helperText = source === 'missing'
    ? `No current date available · planned ${formatDuration(duration)}`
    : `${sourceLabel}: ${formatDate(displayedMillis)} · planned ${formatDuration(duration)}`;

  return (
    <div className="admin-stage-editor">
      <div className="admin-stage-editor__copy">
        <strong>{fieldLabel(field)}</strong>
        <span>{helperText}</span>
      </div>
      <div className="admin-stage-editor__controls">
        <input
          type="datetime-local"
          value={value}
          placeholder={displayedMillis ? formatDate(displayedMillis) : 'Choose date and time'}
          onChange={event => onDateDraftChange(collab.id, field, event.target.value)}
          aria-label={`${fieldLabel(field)} for ${collab.name}`}
        />
        <button onClick={onSave} disabled={saving || !isDirty || !value}>
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  );
}
