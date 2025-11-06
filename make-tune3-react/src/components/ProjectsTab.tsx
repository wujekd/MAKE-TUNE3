import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { DashboardService, ProjectService } from '../services';
import type { ProjectOverviewItem } from '../services/dashboardService';
import { TagInput } from './TagInput';
import { TagUtils } from '../utils/tagUtils';
import { LoadingSpinner } from './LoadingSpinner';
import { ProjectListItem } from './ProjectListItem';
import './ProjectHistory.css';

interface ProjectsTabProps {
  user: { uid: string } | null;
  authLoading: boolean;
}

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

const computeStageWindow = (
  current: NonNullable<ProjectOverviewItem['currentCollaboration']>
): { status: string; startAt: number | null; endAt: number | null } => {
  const status = String(current.status || '').toLowerCase();

  if (status === 'submission') {
    const end = current.submissionCloseAt ?? null;
    const durationMs =
      typeof current.submissionDuration === 'number' && current.submissionDuration > 0
        ? current.submissionDuration * 1000
        : null;
    const start = end && durationMs ? end - durationMs : current.publishedAt ?? null;
    return { status, startAt: start, endAt: end };
  }

  if (status === 'voting') {
    const end = current.votingCloseAt ?? null;
    const durationMs =
      typeof current.votingDuration === 'number' && current.votingDuration > 0
        ? current.votingDuration * 1000
        : null;
    const start = end && durationMs ? end - durationMs : current.submissionCloseAt ?? null;
    return { status, startAt: start, endAt: end };
  }

  if (status === 'completed') {
    const end = current.votingCloseAt ?? current.submissionCloseAt ?? current.updatedAt ?? null;
    return { status, startAt: end, endAt: end };
  }

  return { status, startAt: null, endAt: null };
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
      return;
    }
    void loadProjects(user.uid);
  }, [user]);

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
        {!authLoading && user && projectsLoaded && projects.map(project => {
          const current = project.currentCollaboration;
          const stageWindow = current ? computeStageWindow(current) : null;
          const normalizedStatus =
            stageWindow && ['submission', 'voting', 'completed'].includes(stageWindow.status)
              ? stageWindow.status
              : null;

          const stageInfo =
            current && normalizedStatus
              ? {
                  status: normalizedStatus,
                  label: formatCountdownLabel(
                    current.status,
                    current.submissionCloseAt,
                    current.votingCloseAt
                  ),
                  startAt: stageWindow?.startAt ?? null,
                  endAt: stageWindow?.endAt ?? null
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
    </>
  );
}

