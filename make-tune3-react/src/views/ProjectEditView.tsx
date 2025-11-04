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
import { CollabListItem } from '../components/CollabListItem';
import styles from './ProjectEditView.module.css';

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
    <div className={styles.container}>
      <div className={styles.hero}>
        <div className={styles.heroTitle}>{project?.name || 'project'}</div>
        <div className={styles.heroDescription}>{project?.description}</div>
        <div className={styles.heroMeta}>
          {project
            ? new Date(
                (project as any).createdAt?.toMillis
                  ? (project as any).createdAt.toMillis()
                  : (project as any).createdAt
              ).toLocaleString()
            : ''}
        </div>
      </div>

      <div className={styles.layout}>
        <div className={`project-history ${styles.managerColumn}`}>
          <h4 className="project-history-title">collaboration manager</h4>
          <div className={`collab-list ${styles.managerList}`}>
            {loading && <div className={styles.emptyState}>loading...</div>}
            {error && <div className={styles.emptyState}>{error}</div>}
            {!loading && !error && (
              <>
                <CollabListItem
                  title="+ add collaboration"
                  onClick={() => {
                    setSelectedId(null);
                    setMode('create');
                  }}
                  isSelected={mode === 'create'}
                />
                {sortedCollabs.length === 0 ? (
                  <div className={styles.emptyState}>no collaborations yet</div>
                ) : (
                  sortedCollabs.map(col => (
                    <CollabListItem
                      key={col.id}
                      title={col.name}
                      subtitle={col.status}
                      statusIndicator="●"
                      isSelected={selectedId === col.id}
                      onClick={() => { setSelectedId(col.id); setMode('view'); }}
                    />
                  ))
                )}
              </>
            )}
          </div>
        </div>
        <div className={styles.detailsArea}>
          <div className={`project-history ${styles.detailsColumn}`}>
            <h4 className="project-history-title">details</h4>
            <div className={`collab-list ${styles.detailsPanel}`}>
              <div className={styles.detailsScroll}>
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
          <div className={styles.mixerColumn}>
            <Mixer1Channel state={audioState} />
          </div>
        </div>
      </div>
    </div>
  );
}
