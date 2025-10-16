import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { Project, Collaboration } from '../types/collaboration';
import { CollaborationService } from '../services/collaborationService';
import '../components/ProjectHistory.css';
import { CollaborationDetails } from '../components/CollaborationDetails';

export function ProjectEditView() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [collabs, setCollabs] = useState<Collaboration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<'none'|'create'|'view'|'edit'>('none');

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
        console.log(c)
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
        {project && (
          <button
            onClick={async () => {
              if (!project) return;
              const ok = window.confirm('delete this project? this cannot be undone');
              if (!ok) return;
              try {
                await CollaborationService.deleteProject(project.id);
                navigate('/collabs');
              } catch (e) {
                alert('failed to delete project');
              }
            }}
            style={{ background: 'var(--danger, #a33)', color: 'white', padding: '8px 12px', borderRadius: 6 }}
          >
            delete project
          </button>
        )}
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
              <div key={col.id} className="collab-history-item" onClick={() => { setSelectedId(col.id); setMode('view'); }}>
                <div className="collab-status-indicator">●</div>
                <div className="collab-info">
                  <span className="collab-name">{col.name}</span>
                  <span className="collab-stage">{col.status}</span>
                </div>
              </div>
            ))}
            <div className="collab-history-item" onClick={() => { setSelectedId(null); setMode('create'); }}>
              <div className="collab-info">
                <span className="collab-name">+ add collaboration</span>
              </div>
            </div>
          </div>
        </div>
        <div className="project-history" style={{ maxWidth: 480, width: '100%', minHeight: 280 }}>
          <h4 className="project-history-title">details</h4>
          <div className="collab-list" style={{ padding: 12 }}>
            <CollaborationDetails
              mode={mode}
              selectedId={selectedId}
              collabs={collabs}
              project={project}
              onModeChange={setMode}
              onCollabsUpdate={setCollabs}
              onSelectedIdChange={setSelectedId}
            />
          </div>
        </div>
      </div>
    </div>
  );
}