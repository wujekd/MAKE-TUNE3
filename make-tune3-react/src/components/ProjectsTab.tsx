import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { DashboardService, ProjectService, CollaborationService, GroupService } from '../services';
import type { ProjectOverviewItem } from '../services/dashboardService';
import { LoadingSpinner } from './LoadingSpinner';
import { ProjectListItem } from './ProjectListItem';
import { UserActivityListItem } from './UserActivityListItem';
import { CountUpValue } from './CountUpValue';
import { computeStageInfo } from '../utils/stageUtils';
import { canCreateProject, getProjectAllowance } from '../utils/permissions';
import { useUIStore } from '../stores/useUIStore';
import { useAppStore } from '../stores/appStore';
import type { User } from '../types/auth';
import './ProjectHistory.css';
import './UserActivityStyles.css';

interface ProjectsTabProps {
  user: User | null;
  authLoading: boolean;
  createProjectRequestKey?: number;
}

const formatDateTime = (value: number | null | undefined): string => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString();
};

export function ProjectsTab({ user, authLoading, createProjectRequestKey = 0 }: ProjectsTabProps) {
  const userId = user?.uid;
  const lastHandledCreateRequestRef = useRef(0);
  const [projects, setProjects] = useState<ProjectOverviewItem[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [projectsLoaded, setProjectsLoaded] = useState(false);
  const [projectsError, setProjectsError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [availableGroups, setAvailableGroups] = useState<Array<{ id: string; name: string }>>([]);
  const [groupIds, setGroupIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Moderation state
  const [mode, setMode] = useState<'list' | 'moderate'>('list');
  const [moderationCollabs, setModerationCollabs] = useState<Array<{ id: string; name: string }>>([]);
  const [moderationLoading, setModerationLoading] = useState(false);
  const [moderationLoaded, setModerationLoaded] = useState(false);
  const [moderationError, setModerationError] = useState<string | null>(null);
  const recountingRef = useRef(false);

  const maybeRecountProjectCount = useCallback(async (targetUserId: string, projectLength: number) => {
    if (!userId || userId !== targetUserId) return;
    const currentCount = user?.projectCount ?? 0;
    if (currentCount === projectLength) return;
    if (recountingRef.current) return;
    recountingRef.current = true;
    try {
      const updatedCount = await ProjectService.recountMyProjectCount();
      useAppStore.setState(state => ({
        auth: {
          ...state.auth,
          user: state.auth.user ? {
            ...state.auth.user,
            projectCount: updatedCount
          } : null
        }
      }));
    } catch (err) {
      console.warn('Failed to reconcile project count', err);
    } finally {
      recountingRef.current = false;
    }
  }, [userId, user?.projectCount]);

  const loadProjects = useCallback(async (targetUserId: string) => {
    setProjectsLoading(true);
    setProjectsError(null);
    try {
      const items = await DashboardService.listMyProjectsOverview();
      setProjects(items);
      setProjectsLoaded(true);
      await maybeRecountProjectCount(targetUserId, items.length);
    } catch (e: any) {
      console.error('failed to load projects overview', e);
      try {
        const fallback = await ProjectService.listUserProjects(targetUserId);
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
        await maybeRecountProjectCount(targetUserId, normalized.length);
      } catch (fallbackErr: any) {
        console.error('failed to load fallback projects', fallbackErr);
        setProjectsError(fallbackErr?.message || 'failed to load projects');
        setProjectsLoaded(true);
      }
    } finally {
      setProjectsLoading(false);
    }
  }, [maybeRecountProjectCount]);

  useEffect(() => {
    if (!userId) {
      setProjects([]);
      setProjectsLoaded(false);
      setShowForm(false);
      setAvailableGroups([]);
      return;
    }
    void loadProjects(userId);
    GroupService.listMyGroups()
      .then(groups => setAvailableGroups(groups.map(group => ({ id: group.id, name: group.name }))))
      .catch(() => setAvailableGroups([]));
  }, [userId, loadProjects]);

  useEffect(() => {
    if (!user || projectsLoading || !projectsLoaded) return;
    if (projects.length === 0 && !showForm && canCreateProject(user)) {
      setShowForm(true);
    }
  }, [user, projectsLoading, projectsLoaded, projects.length, showForm]);

  useEffect(() => {
    if (!createProjectRequestKey || createProjectRequestKey === lastHandledCreateRequestRef.current) {
      return;
    }

    lastHandledCreateRequestRef.current = createProjectRequestKey;
    setMode('list');

    if (canCreateProject(user)) {
      setShowForm(true);
      setFormError(null);
    }
  }, [createProjectRequestKey, user]);

  const handleCreateProject = async () => {
    if (!user) return;
    const trimmed = name.trim();
    if (!trimmed) { setFormError('name required'); return; }
    if (trimmed.length > 80) { setFormError('name too long'); return; }
    if (description.length > 500) { setFormError('description too long'); return; }

    setSaving(true);
    setFormError(null);
    try {
      await ProjectService.createProjectWithUniqueName({
        name: trimmed,
        description,
        ownerId: user.uid,
        groupIds
      });
      // Update the user's projectCount in the auth store to reflect the new project
      useAppStore.setState(state => ({
        auth: {
          ...state.auth,
          user: state.auth.user ? {
            ...state.auth.user,
            projectCount: (state.auth.user.projectCount ?? 0) + 1
          } : null
        }
      }));
      setShowForm(false);
      setName('');
      setDescription('');
      setGroupIds([]);
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
    setGroupIds([]);
    setFormError(null);
  };

  const loadModeration = useCallback(async () => {
    if (moderationLoading) return;
    setModerationLoading(true);
    setModerationError(null);
    try {
      const items = await CollaborationService.listMyModerationQueue();
      setModerationCollabs(items);
      setModerationLoaded(true);
    } catch (e: any) {
      setModerationError(e?.message || 'failed to load moderation queue');
    } finally {
      setModerationLoading(false);
    }
  }, [moderationLoading]);

  // Eagerly fetch moderation count so badge shows without user clicking
  useEffect(() => {
    if (userId && !moderationLoaded && !moderationLoading) {
      void loadModeration();
    }
  }, [userId, loadModeration, moderationLoaded, moderationLoading]);

  // Reload moderation data when switching to moderate view
  useEffect(() => {
    if (mode === 'moderate' && userId) {
      void loadModeration();
    }
  }, [mode, userId, loadModeration]);

  const pendingCount = moderationCollabs.length;

  return (
    <section className="user-activity__section">
      <div className="user-activity__section-header" style={{ alignItems: 'center' }}>
        <h4 className="project-history-title card__title user-activity__section-title" style={{ lineHeight: 1.3, minHeight: '2.6em', display: 'flex', alignItems: 'center' }}>
          {mode === 'list' ? 'my projects' : <>moderation<br />queue</>}
        </h4>
        <div className="user-activity__header-actions">
          {getProjectAllowance(user) && getProjectAllowance(user)!.limit !== Infinity && (
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted, #888)' }}>
              {getProjectAllowance(user)!.current} / {getProjectAllowance(user)!.limit}
            </span>
          )}
          {mode === 'list' && (
            <button
              className="user-activity__action-button user-activity__action-button--queue"
              disabled={!user || authLoading}
              onClick={() => setMode('moderate')}
            >
              review queue{pendingCount > 0 && <span className="user-activity__badge"><CountUpValue value={pendingCount} /></span>}
            </button>
          )}
          {mode === 'moderate' && (
            <button
              className="user-activity__action-button user-activity__action-button--queue"
              onClick={() => setMode('list')}
            >
              back to projects
            </button>
          )}
          {canCreateProject(user) && (
            <button
              className="user-activity__action-button user-activity__action-button--create"
              disabled={!user || authLoading}
              onClick={() => setShowForm(v => !v)}
            >
              create project
            </button>
          )}
        </div>
      </div>
      <div className="collab-list list user-activity__list">
        {mode === 'moderate' && (
          <>
            {(authLoading || (user && !moderationLoaded)) && (
              <div className="user-activity__loading">
                <LoadingSpinner size={24} />
              </div>
            )}
            {!authLoading && user && moderationLoaded && moderationError && (
              <div className="user-activity__message">{moderationError}</div>
            )}
            {!authLoading && user && moderationLoaded && !moderationError && moderationCollabs.length === 0 && (
              <div className="user-activity__message user-activity__message--muted">no collaborations need moderation</div>
            )}
            {!authLoading && user && moderationLoaded && moderationCollabs.map(item => (
              <UserActivityListItem
                key={item.id}
                title={item.name || 'untitled'}
                subtitle="pending moderation"
                status="pending moderation"
                to={`/collab/${encodeURIComponent(item.id)}/moderate`}
                actionLabel="review"
              />
            ))}
          </>
        )}

        {mode === 'list' && showForm && (
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
            {availableGroups.length > 0 && (
              <div className="user-activity__form-group" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ color: 'var(--text-muted, #888)', fontSize: 12 }}>project groups</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {availableGroups.map(group => (
                    <label key={group.id} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
                      <input
                        type="checkbox"
                        checked={groupIds.includes(group.id)}
                        disabled={saving}
                        onChange={e => {
                          setGroupIds(current => e.target.checked
                            ? Array.from(new Set([...current, group.id])).slice(0, 5)
                            : current.filter(id => id !== group.id));
                        }}
                      />
                      {group.name}
                    </label>
                  ))}
                </div>
              </div>
            )}
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

        {mode === 'list' && (authLoading || (user && !projectsLoaded)) && (
          <div className="user-activity__loading">
            <LoadingSpinner size={24} />
          </div>
        )}
        {mode === 'list' && !authLoading && !user && (
          <div className="user-activity__message">
            <Link to="/auth?mode=login">login</Link> to see your projects
          </div>
        )}
        {mode === 'list' && !authLoading && user && projectsLoaded && projectsError && (
          <div className="user-activity__message">{projectsError}</div>
        )}
        {mode === 'list' && !authLoading && user && projectsLoaded && !projectsError && projects.length === 0 && canCreateProject(user) && (
          <div className="user-activity__empty-card">
            <p className="user-activity__empty-title">Create your first project</p>
            <p className="user-activity__empty-body">
              Projects collect collaborations, submissions, and voting. Spin one up to start hosting new music.
            </p>
          </div>
        )}
        {mode === 'list' && !authLoading && user && projectsLoaded && !projectsError && projects.length === 0 && !canCreateProject(user) && (
          <div className="user-activity__cta-card">
            <p className="user-activity__cta-title">Want to create projects?</p>
            <p className="user-activity__cta-body">
              Request creator access to start hosting your own music collaborations.
            </p>
            <button
              className="user-activity__cta-button"
              onClick={() => useUIStore.getState().openFeedbackModal('creator_request')}
            >
              Request Creator Access
            </button>
          </div>
        )}
        {mode === 'list' && !authLoading && user && projectsLoaded && projects.map(project => {
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
