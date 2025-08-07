import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { Project, Collaboration } from '../types/collaboration';
import { CollaborationService } from '../services/collaborationService';
import '../components/ProjectHistory.css';
import { CreateCollaboration } from '../components/CreateCollaboration';

export function ProjectEditView() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [collabs, setCollabs] = useState<Collaboration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (!projectId) throw new Error('missing project id');
        const p = await CollaborationService.getProject(projectId);
        if (!p) throw new Error('project not found');
        const c = await CollaborationService.getCollaborationsByProject(projectId);
        if (!mounted) return;
        setProject(p);
        setCollabs(c);
      } catch (e: any) {
        if (mounted) setError(e?.message || 'failed to load');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [projectId]);

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button onClick={() => navigate('/collabs')}>← back</button>
      </div>
      <div style={{
        width: '100%',
        minHeight: 180,
        borderRadius: 12,
        background: 'linear-gradient(135deg, var(--primary1-700), var(--primary1-900))',
        color: 'var(--white)',
        padding: 24,
        display: 'flex',
        flexDirection: 'column',
        gap: 8
      }}>
        <div style={{ fontSize: 24, fontWeight: 700 }}>{project?.name || 'project'}</div>
        <div style={{ opacity: 0.8 }}>{project?.description}</div>
        <div style={{ opacity: 0.7, fontSize: 12 }}>
          {project ? new Date((project as any).createdAt?.toMillis ? (project as any).createdAt.toMillis() : (project as any).createdAt).toLocaleString() : ''}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 16 }}>
        <div className="project-history" style={{ maxWidth: 480, width: '100%' }}>
          <h4 className="project-history-title">collaboration manager</h4>
          <div className="collab-list">
            {loading && <div style={{ color: 'var(--white)' }}>loading...</div>}
            {error && <div style={{ color: 'var(--white)' }}>{error}</div>}
            {!loading && !error && collabs.length === 0 && (
              <div style={{ color: 'var(--white)' }}>no collaborations yet</div>
            )}
            {collabs.map(col => (
              <div key={col.id} className="collab-history-item">
                <div className="collab-status-indicator">●</div>
                <div className="collab-info">
                  <span className="collab-name">{col.name}</span>
                  <span className="collab-stage">{col.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="project-history" style={{ maxWidth: 480, width: '100%' }}>
          <h4 className="project-history-title">create collaboration</h4>
          <div className="collab-list">
            {project && (
              <CreateCollaboration
                projectId={project.id}
                onCreated={(c) => setCollabs(prev => [c, ...prev])}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

