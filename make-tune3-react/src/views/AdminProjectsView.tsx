import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Collaboration, Project } from '../types/collaboration';
import { CollaborationService, ProjectService } from '../services';

type CollabMap = Record<string, Collaboration[]>;

export function AdminProjectsView() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [collaborations, setCollaborations] = useState<CollabMap>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionTarget, setActionTarget] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    let isMounted = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [allProjects, allCollaborations] = await Promise.all([
          ProjectService.listAllProjects(),
          CollaborationService.listAllCollaborations()
        ]);

        if (!isMounted) return;

        const grouped = allCollaborations.reduce<CollabMap>((acc, collab) => {
          const key = collab.projectId;
          if (!acc[key]) acc[key] = [];
          acc[key].push(collab);
          return acc;
        }, {});

        setProjects(allProjects);
        setCollaborations(grouped);
      } catch (err: any) {
        if (isMounted) setError(err?.message || 'Failed to load admin data');
      } finally {
        if (isMounted) setLoading(false);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  const totalCollaborations = useMemo(() => {
    return Object.values(collaborations).reduce((sum, list) => sum + list.length, 0);
  }, [collaborations]);

  const handleEditProject = (projectId: string) => {
    navigate(`/project/${projectId}`);
  };

  const handleEditCollaboration = (projectId: string, collaborationId: string) => {
    navigate(`/project/${projectId}?collab=${collaborationId}`);
  };

  const handleDeleteCollaboration = async (projectId: string, collaborationId: string) => {
    const collabList = collaborations[projectId] || [];
    const collaboration = collabList.find(c => c.id === collaborationId);
    const label = collaboration?.name || collaborationId;
    const confirmed = window.confirm(`Delete collaboration "${label}"? This cannot be undone.`);
    if (!confirmed) return;

    setActionTarget(`collab:${collaborationId}`);
    setActionError(null);
    try {
      await CollaborationService.deleteCollaboration(collaborationId);
      setCollaborations(prev => {
        const existing = prev[projectId] || [];
        const updated = existing.filter(c => c.id !== collaborationId);
        return { ...prev, [projectId]: updated };
      });
    } catch (err: any) {
      setActionError(err?.message || 'Failed to delete collaboration');
    } finally {
      setActionTarget(null);
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    const project = projects.find(p => p.id === projectId);
    const label = project?.name || projectId;
    const relatedCollabs = collaborations[projectId] || [];

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
      setProjects(prev => prev.filter(p => p.id !== projectId));
      setCollaborations(prev => {
        const clone = { ...prev };
        delete clone[projectId];
        return clone;
      });
    } catch (err: any) {
      setActionError(err?.message || 'Failed to delete project');
    } finally {
      setActionTarget(null);
    }
  };

  return (
    <div
      style={{
        padding: 24,
        background: 'var(--primary1-800)',
        height: '100%',
        minHeight: 0,
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      <div
        style={{
          maxWidth: 960,
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          width: '100%',
          flex: 1,
          minHeight: 0
        }}
      >
        <h2 style={{ color: 'var(--white)' }}>Admin: Projects & Collaborations</h2>
        <div style={{ color: 'var(--white)', opacity: 0.8 }}>
          {loading ? 'Loading data…' : `${projects.length} project(s), ${totalCollaborations} collaboration(s)`}
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
          {projects.map(project => {
            const projectCollabs = collaborations[project.id] || [];
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
                      Owner: {(project as any).ownerId || '—'} · Created:{' '}
                      {project.createdAt
                        ? new Date((project as any).createdAt?.toMillis ? (project as any).createdAt.toMillis() : (project as any).createdAt).toLocaleString()
                        : 'unknown'}
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
                  <div style={{ fontWeight: 600 }}>Collaborations ({projectCollabs.length})</div>
                  {projectCollabs.length === 0 ? (
                    <div style={{ opacity: 0.7, fontSize: 13 }}>No collaborations linked</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {projectCollabs.map(collab => {
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

        {!loading && projects.length === 0 && !error && (
          <div style={{ color: 'var(--white)', opacity: 0.75 }}>No projects found.</div>
        )}
      </div>
    </div>
  );
}
