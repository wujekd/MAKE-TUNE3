import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AdminService, CollaborationService, ProjectService } from '../services';
import type { AdminCollaborationSummary, AdminProjectWithCollabs } from '../services/adminService';
import { AdminLayout } from '../components/AdminLayout';
import { useAppStore } from '../stores/appStore';
import './AdminProjectsView.css';

type CollabDateField = 'publishedAt' | 'submissionCloseAt' | 'votingCloseAt' | 'completedAt';
type StageDateSource = 'saved' | 'estimated' | 'missing';
type DateModalState = {
  projectId: string;
  collab: AdminCollaborationSummary;
};

const DATE_FIELDS: CollabDateField[] = ['publishedAt', 'submissionCloseAt', 'votingCloseAt', 'completedAt'];

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

const fieldLabel = (field: CollabDateField) => {
  switch (field) {
    case 'publishedAt':
      return 'Published';
    case 'submissionCloseAt':
      return 'Submission ends';
    case 'votingCloseAt':
      return 'Voting ends';
    case 'completedAt':
      return 'Completed';
  }
};

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

const getDateValue = (collab: AdminCollaborationSummary, field: CollabDateField) => {
  if (field === 'submissionCloseAt') return getSubmissionEnd(collab);
  if (field === 'votingCloseAt') return getVotingEnd(collab);
  return collab[field] ?? null;
};

const getDateSource = (collab: AdminCollaborationSummary, field: CollabDateField): StageDateSource => {
  if (collab[field]) return 'saved';
  return getDateValue(collab, field) ? 'estimated' : 'missing';
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
  const [dateModal, setDateModal] = useState<DateModalState | null>(null);
  const [dateDrafts, setDateDrafts] = useState<Record<CollabDateField, string>>({
    publishedAt: '',
    submissionCloseAt: '',
    votingCloseAt: '',
    completedAt: ''
  });
  const [shiftDays, setShiftDays] = useState('7');

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
      setDateModal(null);

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

  const openDateModal = (projectId: string, collab: AdminCollaborationSummary) => {
    setDateModal({ projectId, collab });
    setDateDrafts({
      publishedAt: formatDateInput(collab.publishedAt),
      submissionCloseAt: formatDateInput(getSubmissionEnd(collab)),
      votingCloseAt: formatDateInput(getVotingEnd(collab)),
      completedAt: formatDateInput(collab.completedAt)
    });
    setShiftDays('7');
    setActionError(null);
  };

  const updateCollabInState = (
    projectId: string,
    collabId: string,
    updater: (collab: AdminCollaborationSummary) => AdminCollaborationSummary
  ) => {
    setItems(prev => prev.map(item => {
      if (item.project.id !== projectId) return item;
      return {
        ...item,
        collaborations: item.collaborations.map(existing =>
          existing.id === collabId ? updater(existing) : existing
        )
      };
    }));
  };

  const validateDateOrder = (values: Partial<Record<CollabDateField, number | null>>) => {
    const publishedAt = values.publishedAt ?? null;
    const submissionCloseAt = values.submissionCloseAt ?? null;
    const votingCloseAt = values.votingCloseAt ?? null;
    const completedAt = values.completedAt ?? null;
    if (publishedAt && submissionCloseAt && submissionCloseAt < publishedAt) {
      return 'Submission end must be after the publish date.';
    }
    if (submissionCloseAt && votingCloseAt && votingCloseAt < submissionCloseAt) {
      return 'Voting end must be after submission end.';
    }
    if (votingCloseAt && completedAt && completedAt < votingCloseAt) {
      return 'Completed date must be after voting end.';
    }
    return null;
  };

  const handleSaveCollaborationDates = async () => {
    if (!dateModal) return;

    const updates = DATE_FIELDS.reduce((acc, field) => {
      const value = dateDrafts[field];
      const millis = parseDateInput(value);
      acc[field] = millis;
      return acc;
    }, {} as Record<CollabDateField, number | null>);

    const invalidField = DATE_FIELDS.find(field => dateDrafts[field] && !updates[field]);
    if (invalidField) {
      setActionError(`${fieldLabel(invalidField)} needs a valid date and time.`);
      return;
    }

    const orderError = validateDateOrder(updates);
    if (orderError) {
      setActionError(orderError);
      return;
    }

    const { projectId, collab } = dateModal;
    setActionTarget(`dates:${collab.id}`);
    setActionError(null);
    try {
      await AdminService.updateCollaborationStageDates(collab.id, updates);
      updateCollabInState(projectId, collab.id, existing => ({
        ...existing,
        ...updates,
        updatedAt: Date.now()
      }));
      setDateModal(null);
    } catch (err: any) {
      setActionError(err?.message || 'Failed to update collaboration dates');
    } finally {
      setActionTarget(null);
    }
  };

  const handleShiftCollaborationDates = async () => {
    if (!dateModal) return;

    const days = Number(shiftDays);
    if (!Number.isInteger(days) || days === 0) {
      setActionError('Shift needs a whole number of days, such as 7 or -3.');
      return;
    }

    const confirmed = window.confirm(
      `Shift "${dateModal.collab.name || 'Untitled collaboration'}" and its submission dates by ${days} day(s)?`
    );
    if (!confirmed) return;

    const { projectId, collab } = dateModal;
    const offset = days * 24 * 60 * 60 * 1000;
    setActionTarget(`shift:${collab.id}`);
    setActionError(null);
    try {
      await AdminService.shiftCollaborationDates(collab.id, days);
      updateCollabInState(projectId, collab.id, existing => ({
        ...existing,
        publishedAt: existing.publishedAt ? existing.publishedAt + offset : existing.publishedAt,
        submissionCloseAt: getSubmissionEnd(existing) ? getSubmissionEnd(existing)! + offset : existing.submissionCloseAt,
        votingCloseAt: getVotingEnd(existing) ? getVotingEnd(existing)! + offset : existing.votingCloseAt,
        completedAt: existing.completedAt ? existing.completedAt + offset : existing.completedAt,
        updatedAt: Date.now()
      }));
      setDateModal(null);
    } catch (err: any) {
      setActionError(err?.message || 'Failed to shift collaboration dates');
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
                          onOpenDates={openDateModal}
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

        {dateModal && (
          <CollaborationDatesModal
            collab={dateModal.collab}
            dateDrafts={dateDrafts}
            shiftDays={shiftDays}
            saving={actionTarget === `dates:${dateModal.collab.id}`}
            shifting={actionTarget === `shift:${dateModal.collab.id}`}
            onDateDraftChange={(field, value) => setDateDrafts(prev => ({ ...prev, [field]: value }))}
            onShiftDaysChange={setShiftDays}
            onSave={handleSaveCollaborationDates}
            onShift={handleShiftCollaborationDates}
            onClose={() => {
              if (actionTarget) return;
              setDateModal(null);
            }}
          />
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
  onOpenDates,
  onEdit,
  onDelete
}: {
  collab: AdminCollaborationSummary;
  projectId: string;
  actionTarget: string | null;
  onOpenDates: (projectId: string, collab: AdminCollaborationSummary) => void;
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

        <div className="admin-collab__dates">
          <DateSummaryItem label="Submission ends" value={getSubmissionEnd(collab)} source={getDateSource(collab, 'submissionCloseAt')} />
          <DateSummaryItem label="Voting ends" value={getVotingEnd(collab)} source={getDateSource(collab, 'votingCloseAt')} />
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
        <button onClick={() => onOpenDates(projectId, collab)}>Adjust dates</button>
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

function DateSummaryItem({ label, value, source }: { label: string; value: number | null; source: StageDateSource }) {
  return (
    <div className="admin-date-summary">
      <span>{label}</span>
      <strong>{formatDate(value)}</strong>
      {source === 'estimated' && <em>Estimated</em>}
    </div>
  );
}

function CollaborationDatesModal({
  collab,
  dateDrafts,
  shiftDays,
  saving,
  shifting,
  onDateDraftChange,
  onShiftDaysChange,
  onSave,
  onShift,
  onClose
}: {
  collab: AdminCollaborationSummary;
  dateDrafts: Record<CollabDateField, string>;
  shiftDays: string;
  saving: boolean;
  shifting: boolean;
  onDateDraftChange: (field: CollabDateField, value: string) => void;
  onShiftDaysChange: (value: string) => void;
  onSave: () => void;
  onShift: () => void;
  onClose: () => void;
}) {
  const busy = saving || shifting;
  const hasChanges = DATE_FIELDS.some(field => dateDrafts[field] !== formatDateInput(getDateValue(collab, field)));

  return (
    <div className="admin-date-modal-backdrop" role="presentation" onMouseDown={onClose}>
      <div
        className="admin-date-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-date-modal-title"
        onMouseDown={event => event.stopPropagation()}
      >
        <header className="admin-date-modal__header">
          <div>
            <span className="admin-project-card__eyebrow">Collaboration dates</span>
            <h3 id="admin-date-modal-title">{collab.name || 'Untitled collaboration'}</h3>
          </div>
          <button className="admin-date-modal__close" onClick={onClose} disabled={busy} aria-label="Close date editor">
            x
          </button>
        </header>

        <div className="admin-date-modal__grid">
          {DATE_FIELDS.map(field => {
            const source = getDateSource(collab, field);
            const helper = source === 'estimated'
              ? `Estimated from duration · ${formatDate(getDateValue(collab, field))}`
              : source === 'missing'
                ? 'No current date'
                : `Current value · ${formatDate(getDateValue(collab, field))}`;

            return (
              <label key={field} className="admin-date-field">
                <span>{fieldLabel(field)}</span>
                <input
                  type="datetime-local"
                  value={dateDrafts[field]}
                  onChange={event => onDateDraftChange(field, event.target.value)}
                  disabled={busy}
                />
                <small>{helper}</small>
              </label>
            );
          })}
        </div>

        <section className="admin-date-modal__shift" aria-label="Shift all dates">
          <div>
            <strong>Shift all dates</strong>
            <span>Moves collaboration dates and submitted-track timestamps together.</span>
          </div>
          <div className="admin-date-modal__shift-controls">
            <input
              type="number"
              step="1"
              value={shiftDays}
              onChange={event => onShiftDaysChange(event.target.value)}
              disabled={busy}
              aria-label="Days to shift"
            />
            <button onClick={onShift} disabled={busy || !shiftDays}>
              {shifting ? 'Shifting...' : 'Shift'}
            </button>
          </div>
        </section>

        <footer className="admin-date-modal__footer">
          <button onClick={onClose} disabled={busy}>Cancel</button>
          <button onClick={onSave} disabled={busy || !hasChanges}>
            {saving ? 'Saving...' : 'Save dates'}
          </button>
        </footer>
      </div>
    </div>
  );
}
