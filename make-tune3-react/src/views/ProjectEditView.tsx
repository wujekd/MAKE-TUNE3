import { useEffect, useState, useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import type { Project, Collaboration } from '../types/collaboration';
import { ProjectService, CollaborationService } from '../services';
import { useAppStore } from '../stores/appStore';
import '../components/ProjectHistory.css';
import { CollaborationDetails } from '../components/CollaborationDetails';
import { Mixer1Channel } from '../components/Mixer1Channel';
import { useAudioStore } from '../stores';
import { usePlaybackStore } from '../stores/usePlaybackStore';

export function ProjectEditView() {
  const { projectId } = useParams();
  const [searchParams] = useSearchParams();
  const setCurrentProject = useAppStore(s => s.collaboration.setCurrentProject);
  const [project, setProject] = useState<Project | null>(null);
  const [collabs, setCollabs] = useState<Collaboration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<'none'|'create'|'view'|'edit'>('none');
  const [initialSelectionApplied, setInitialSelectionApplied] = useState(false);
  const audioState = useAudioStore(s => s.state);
  const stopBackingPlayback = usePlaybackStore(s => s.stopBackingPlayback);

  const sortedCollabs = useMemo(() => {
    return [...collabs].sort((a, b) => {
      const aTime = (a as any).createdAt?.toMillis ? (a as any).createdAt.toMillis() : 0;
      const bTime = (b as any).createdAt?.toMillis ? (b as any).createdAt.toMillis() : 0;
      return bTime - aTime;
    });
  }, [collabs]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (!projectId) throw new Error('missing project id');
        const p = await ProjectService.getProject(projectId);
        if (!p) throw new Error('project not found');
        const c = await CollaborationService.getCollaborationsByProject(projectId);
        if (!mounted) return;
        setProject(p);
        setCurrentProject(p);
        setCollabs(c);
        console.log(c)
      } catch (e: any) {
        if (mounted) setError(e?.message || 'failed to load');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [projectId, setCurrentProject]);

  useEffect(() => {
    if (initialSelectionApplied) return;
    if (loading || collabs.length === 0) return;

    const collabParam = searchParams.get('collab');
    
    if (collabParam) {
      const match = collabs.find(c => c.id === collabParam);
      if (match) {
        setSelectedId(collabParam);
        setMode('view');
        setInitialSelectionApplied(true);
        return;
      }
    }

    const activeCollab = collabs.find(c => 
      c.status !== 'unpublished' && c.status !== 'completed'
    );

    if (activeCollab) {
      setSelectedId(activeCollab.id);
      setMode('view');
      setInitialSelectionApplied(true);
      return;
    }

    const sortedCollabs = [...collabs].sort((a, b) => {
      const aTime = (a as any).createdAt?.toMillis ? (a as any).createdAt.toMillis() : 0;
      const bTime = (b as any).createdAt?.toMillis ? (b as any).createdAt.toMillis() : 0;
      return bTime - aTime;
    });

    if (sortedCollabs.length > 0) {
      setSelectedId(sortedCollabs[0].id);
      setMode('view');
    }

    setInitialSelectionApplied(true);
  }, [collabs, searchParams, initialSelectionApplied, loading]);

  useEffect(() => {
    return () => {
      stopBackingPlayback();
    };
  }, [stopBackingPlayback]);

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12, height: '100%', boxSizing: 'border-box', overflow: 'hidden' }}>
      <div style={{
        width: '100%',
        marginTop: 7,
        minHeight: 128,
        borderRadius: 12,
        background: 'linear-gradient(135deg, var(--primary1-700), var(--primary1-900))',
        color: 'var(--white)',
        padding: 12,
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        flexShrink: 0
      }}>
        <div style={{ fontSize: 20, fontWeight: 700 }}>{project?.name || 'project'}</div>
        <div style={{ opacity: 0.8, fontSize: 14 }}>{project?.description}</div>
        <div style={{ opacity: 0.7, fontSize: 11 }}>
          {project ? new Date((project as any).createdAt?.toMillis ? (project as any).createdAt.toMillis() : (project as any).createdAt).toLocaleString() : ''}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, flex: 1, minHeight: 0, maxHeight: '100%', overflow: 'hidden' }}>
        {/* Manager - narrower width */}
        <div className="project-history" style={{ width: '26%', maxWidth: 240, display: 'flex', flexDirection: 'column', minHeight: 0, maxHeight: '100%' }}>
          <h4 className="project-history-title">collaboration manager</h4>
          <div className="collab-list" style={{ flex: 1, overflowY: 'auto', padding: '6px 8px' }}>
            {loading && <div style={{ color: 'var(--white)' }}>loading...</div>}
            {error && <div style={{ color: 'var(--white)' }}>{error}</div>}
            {!loading && !error && (
              <>
                <div 
                  className={`collab-history-item ${mode === 'create' ? 'selected' : ''}`}
                  onClick={() => { setSelectedId(null); setMode('create'); }}
                >
                  <div className="collab-info">
                    <span className="collab-name">+ add collaboration</span>
                  </div>
                </div>
                {sortedCollabs.length === 0 ? (
                  <div style={{ color: 'var(--white)', marginTop: 8 }}>no collaborations yet</div>
                ) : (
                  sortedCollabs.map(col => (
                    <div 
                      key={col.id} 
                      className={`collab-history-item ${selectedId === col.id ? 'selected' : ''}`}
                      onClick={() => { setSelectedId(col.id); setMode('view'); }}
                    >
                      <div className="collab-status-indicator">●</div>
                      <div className="collab-info">
                        <span className="collab-name">{col.name}</span>
                        <span className="collab-stage">{col.status}</span>
                      </div>
                    </div>
                  ))
                )}
              </>
            )}
          </div>
        </div>
        {/* Details + Mixer */}
        <div style={{ display: 'flex', gap: 10, flex: 1, minHeight: 0, maxHeight: '100%', overflow: 'hidden' }}>
          <div className="project-history" style={{ 
            flex: 1,
            maxWidth: 'none', 
            display: 'flex', 
            flexDirection: 'column', 
            minHeight: 0,
            maxHeight: '100%',
            overflow: 'hidden' // Contain overflow at this level
          }}>
            <h4 className="project-history-title">details</h4>
            <div className="collab-list" style={{ 
              padding: 8, 
              flex: 1,
              minHeight: 0, // Important for nested flex scroll
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden' // Contain overflow at this level too
            }}>
              <div style={{
                flex: 1,
                overflowY: 'auto',
                overflowX: 'hidden',
                width: '100%'
              }}>
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
          <div style={{ width: 140, flexShrink: 0, display: 'flex', flexDirection: 'column', minHeight: 0, maxHeight: '100%', overflow: 'hidden' }}>
            <Mixer1Channel state={audioState} />
          </div>
        </div>
      </div>
    </div>
  );
}
