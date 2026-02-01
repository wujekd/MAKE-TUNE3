import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { DashboardService, ProjectService } from '../services';
import type { ProjectOverviewItem } from '../services/dashboardService';
import { TagInput } from './TagInput';
import { TagUtils } from '../utils/tagUtils';
import { LoadingSpinner } from './LoadingSpinner';
import { ProjectListItem } from './ProjectListItem';
import { computeStageInfo } from '../utils/stageUtils';
import { canCreateProject, getProjectAllowance } from '../utils/permissions';
import type { User } from '../types/auth';
import './ProjectHistory.css';
import './UserActivityStyles.css';

interface ProjectsTabProps {
  user: User | null;
  authLoading: boolean;
}

const formatDateTime = (value: number | null | undefined): string => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString();
};

export function ProjectsTab({ user, authLoading }: ProjectsTabProps) {
  const [projects, setProjects] = useState<ProjectOverviewItem[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [projectsLoaded, setProjectsLoaded] = useState(false);
  const [projectsError, setProjectsError] = useState<string | null>(null);

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

  useEffect(() => {
    if (!user) {
      setProjects([]);
      setProjectsLoaded(false);
      setShowForm(false);
      return;
    }
    void loadProjects(user.uid);
  }, [user]);

  useEffect(() => {
    if (!user || projectsLoading || !projectsLoaded) return;
    if (projects.length === 0 && !showForm && canCreateProject(user)) {
      setShowForm(true);
    }
  }, [user, projectsLoading, projectsLoaded, projects.length, showForm]);

  const handleCreateProject = async () => {
    if (!user) return;
    const trimmed = name.trim();
    if (!trimmed) { setFormError('name required'); return; }
    if (trimmed.length > 80) { setFormError('name too long'); return; }
    if (description.length > 500) { setFormError('description too long'); return; }

    const normalized = TagUtils.normalizeTags(tags);

    setSaving(true);
    setFormError(null);
    try {
      await ProjectService.createProjectWithUniqueName({
        name: trimmed,
        description,
        ownerId: user.uid,
        tags: normalized.display,
        tagsKey: normalized.keys
      });
      setShowForm(false);
      setName('');
      setDescription('');
      setTags([]);
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
  };

  const handleCancelForm = () => {
    setShowForm(false);
    setName('');
    setDescription('');
    setTags([]);
    setFormError(null);
  };

  return (
    <section className="user-activity__section">
      <div className="user-activity__section-header">
        <h4 className="project-history-title card__title user-activity__section-title">my projects</h4>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {getProjectAllowance(user) && getProjectAllowance(user)!.limit !== Infinity && (
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted, #888)' }}>
              {getProjectAllowance(user)!.current} / {getProjectAllowance(user)!.limit}
            </span>
          )}
          {canCreateProject(user) && (
            <button
              className="user-activity__action-button"
              disabled={!user || authLoading}
              onClick={() => setShowForm(v => !v)}
            >
              create project
            </button>
          )}
        </div>
      </div>
      <div className="collab-list list user-activity__list">
        {showForm && (
          <div className="collab-history-item list__item user-activity__form-card">
            <input
              placeholder="project name"
              value={name}
              onChange={e => setName(e.target.value)}
              disabled={!user || saving}
            />
            <textarea
              placeholder="description (optional)"
              value={description}
              onChange={e => setDescription(e.target.value)}
              disabled={!user || saving}
              rows={3}
            />
            <TagInput
              tags={tags}
              onChange={setTags}
              disabled={saving}
              placeholder="Add tags..."
            />
            {formError && <div className="user-activity__form-error">{formError}</div>}
            <div className="user-activity__form-actions">
              <button onClick={handleCancelForm} disabled={saving}>
                cancel
              </button>
              <button onClick={handleCreateProject} disabled={!user || saving}>
                {saving ? 'creating...' : 'create'}
              </button>
            </div>
          </div>
        )}
        {(authLoading || (user && !projectsLoaded)) && (
          <div className="user-activity__loading">
            <LoadingSpinner size={24} />
          </div>
        )}
        {!authLoading && !user && (
          <div className="user-activity__message">
            <Link to="/auth?mode=login">login</Link> to see your projects
          </div>
        )}
        {!authLoading && user && projectsLoaded && projectsError && (
          <div className="user-activity__message">{projectsError}</div>
        )}
        {!authLoading && user && projectsLoaded && !projectsError && projects.length === 0 && canCreateProject(user) && (
          <div className="user-activity__empty-card">
            <p className="user-activity__empty-title">Create your first project</p>
            <p className="user-activity__empty-body">
              Projects collect collaborations, submissions, and voting. Spin one up to start hosting new music.
            </p>
          </div>
        )}
        {!authLoading && user && projectsLoaded && !projectsError && projects.length === 0 && !canCreateProject(user) && (
          <div className="user-activity__message user-activity__message--muted">no projects</div>
        )}
        {!authLoading && user && projectsLoaded && projects.map(project => {
          const current = project.currentCollaboration;
          const rawStageInfo = current
            ? computeStageInfo({
              status: current.status,
              submissionCloseAt: current.submissionCloseAt,
              votingCloseAt: current.votingCloseAt,
              submissionDurationMs:
                typeof current.submissionDuration === 'number'
                  ? current.submissionDuration * 1000
                  : null,
              votingDurationMs:
                typeof current.votingDuration === 'number'
                  ? current.votingDuration * 1000
                  : null,
              publishedAt: current.publishedAt,
              updatedAt: current.updatedAt
            })
            : null;

          const stageInfo = rawStageInfo
            ? {
              status: rawStageInfo.status,
              startAt: rawStageInfo.startAt ?? null,
              endAt: rawStageInfo.endAt ?? null,
              label: rawStageInfo.label ?? undefined
            }
            : null;

          return (
            <ProjectListItem
              key={project.projectId}
              to={`/project/${project.projectId}`}
              projectName={project.projectName || 'untitled project'}
              description={project.description}
              createdLabel={`created ${formatDateTime(project.createdAt)}`}
              currentCollabName={current?.name ?? null}
              stageInfo={stageInfo}
            />
          );
        })}
      </div>
    </section>
  );
}
