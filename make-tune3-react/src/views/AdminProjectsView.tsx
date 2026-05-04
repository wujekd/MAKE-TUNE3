import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AdminService, CollaborationService, ProjectService } from '../services';
import type { AdminProjectWithCollabs } from '../services/adminService';
import { AdminLayout } from '../components/AdminLayout';
import { useAppStore } from '../stores/appStore';

export function AdminProjectsView() {
  const [items, setItems] = useState<AdminProjectWithCollabs[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionTarget, setActionTarget] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [pageTokens, setPageTokens] = useState<(string | null)[]>([null]);
  const [currentPage, setCurrentPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  const navigate = useNavigate();
  const { user } = useAppStore(state => state.auth);

  useEffect(() => {
    loadProjects(0, [null]);
  }, []);

  const loadProjects = async (page: number, tokens: (string | null)[]) => {
    setLoading(true);
    setError(null);
    try {
      const result = await AdminService.listProjects(25, tokens[page] ?? null);
      setItems(result.items);
      setHasMore(result.hasMore);

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

  const goToPage = (page: number) => {
    if (page < 0) return;
    loadProjects(page, pageTokens);
  };

  const totalCollaborations = items.reduce((sum, item) => sum + item.collaborations.length, 0);

  const handleEditProject = (projectId: string) => {
    navigate(`/project/${projectId}`);
  };

  const handleEditCollaboration = (projectId: string, collaborationId: string) => {
    navigate(`/project/${projectId}?collab=${collaborationId}`);
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
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        color: 'var(--white)',
        opacity: 0.8
      }}>
        <span>
          {loading ? 'Loading data…' : `Page ${currentPage + 1} · ${items.length} project(s), ${totalCollaborations} collaboration(s)`}
        </span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => goToPage(currentPage - 1)}
            disabled={currentPage === 0 || loading}
            style={{ padding: '4px 12px', fontSize: 12 }}
          >
            Previous
          </button>
          <button
            onClick={() => goToPage(currentPage + 1)}
            disabled={!hasMore || loading}
            style={{ padding: '4px 12px', fontSize: 12 }}
          >
            Next
          </button>
        </div>
      </div>

      {error && (
        <div style={{ color: '#ff6b6b', background: 'rgba(255,107,107,0.15)', padding: 12, borderRadius: 6 }}>
          {error}
        </div>
      )}
      {actionError && (
        <div style={{ color: '#ff6b6b', background: 'rgba(255,107,107,0.15)', padding: 12, borderRadius: 6 }}>
          {actionError}
        </div>
      )}

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          paddingRight: 8
        }}
      >
        {items.map(({ project, collaborations }) => {
          const projectLoading = actionTarget === `project:${project.id}`;

          return (
            <div
              key={project.id}
              style={{
                background: 'var(--primary1-700)',
                borderRadius: 12,
                padding: 16,
                color: 'var(--white)',
                display: 'flex',
                flexDirection: 'column',
                gap: 12
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxWidth: '70%' }}>
                  <span style={{ fontSize: 18, fontWeight: 600 }}>{project.name}</span>
                  {project.description && (
                    <span style={{ opacity: 0.85, fontSize: 14 }}>{project.description}</span>
                  )}
                  <span style={{ opacity: 0.7, fontSize: 12 }}>
                    Owner: {project.ownerId || '—'} · Created:{' '}
                    {project.createdAt ? new Date(project.createdAt).toLocaleString() : 'unknown'}
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <button onClick={() => handleEditProject(project.id)}>Edit project</button>
                  <button
                    onClick={() => handleDeleteProject(project.id)}
                    disabled={projectLoading}
                    style={{ background: '#ff5c5c', color: 'white' }}
                  >
                    {projectLoading ? 'Deleting…' : 'Delete project'}
                  </button>
                </div>
              </div>

              {project.tags && project.tags.length > 0 && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {project.tags.map((tag, index) => (
                    <span
                      key={`${project.id}-tag-${index}`}
                      style={{
                        background: 'var(--primary1-600)',
                        padding: '2px 8px',
                        borderRadius: 8,
                        fontSize: 11,
                        opacity: 0.85
                      }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ fontWeight: 600 }}>Collaborations ({collaborations.length})</div>
                {collaborations.length === 0 ? (
                  <div style={{ opacity: 0.7, fontSize: 13 }}>No collaborations linked</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {collaborations.map(collab => {
                      const collabTarget = `collab:${collab.id}`;
                      const collabLoading = actionTarget === collabTarget;
                      return (
                        <div
                          key={collab.id}
                          style={{
                            background: 'var(--primary1-650, #2e2e3e)',
                            borderRadius: 8,
                            padding: 12,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 6
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
                              <span style={{ fontWeight: 600 }}>{collab.name}</span>
                              {collab.description && (
                                <span style={{ opacity: 0.85, fontSize: 13 }}>{collab.description}</span>
                              )}
                              <span style={{ opacity: 0.7, fontSize: 12 }}>
                                Status: {collab.status} · Submission duration: {collab.submissionDuration}s · Voting duration: {collab.votingDuration}s
                              </span>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                              <button onClick={() => handleEditCollaboration(project.id, collab.id)}>
                                Edit collaboration
                              </button>
                              <button
                                onClick={() => handleDeleteCollaboration(project.id, collab.id)}
                                disabled={collabLoading}
                                style={{ background: '#ff5c5c', color: 'white' }}
                              >
                                {collabLoading ? 'Deleting…' : 'Delete collaboration'}
                              </button>
                            </div>
                          </div>
                          {collab.tags && collab.tags.length > 0 && (
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                              {collab.tags.map((tag, index) => (
                                <span
                                  key={`${collab.id}-tag-${index}`}
                                  style={{
                                    background: 'var(--primary1-600)',
                                    padding: '2px 8px',
                                    borderRadius: 8,
                                    fontSize: 11,
                                    opacity: 0.85
                                  }}
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {!loading && items.length === 0 && !error && (
        <div style={{ color: 'var(--white)', opacity: 0.75 }}>No projects found.</div>
      )}
    </AdminLayout>
  );
}
