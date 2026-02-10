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
import { SimpleListItem } from '../components/SimpleListItem';
import styles from './ProjectEditView.module.css';

export function ProjectEditView() {
  const { projectId } = useParams();
  const [searchParams] = useSearchParams();
  const { user, loading: authLoading } = useAppStore(state => state.auth);
  const setCurrentProject = useAppStore(s => s.collaboration.setCurrentProject);
  const [project, setProject] = useState<Project | null>(null);
  const [collabs, setCollabs] = useState<Collaboration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<'none' | 'create' | 'view' | 'edit'>('none');
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
        // Wait for auth to settle so we know if we are owner
        if (authLoading) return;

        const p = await ProjectService.getProject(projectId);
        if (!p) throw new Error('project not found');

        const isOwner = user?.uid === p.ownerId;
        const isAdmin = user?.isAdmin === true;

        let c: Collaboration[];
        if (isOwner || isAdmin) {
          c = await CollaborationService.getCollaborationsByProject(projectId);
        } else {
          c = await CollaborationService.getPublishedCollaborationsByProject(projectId);
        }

        if (!mounted) return;
        setProject(p);
        setCurrentProject(p);
        setCollabs(c);
        console.log(c);
      } catch (e: any) {
        if (mounted) setError(e?.message || 'failed to load');
      } finally {
        if (mounted && !authLoading) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [projectId, setCurrentProject, user?.uid, user?.isAdmin, authLoading]);

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
    <div className={`view-container ${styles.container}`}>
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
          <h4 className="project-history-title">collaborations</h4>
          <div className={`collab-list ${styles.managerList}`}>
            {loading && <div className={styles.emptyState}>loading...</div>}
            {error && <div className={styles.emptyState}>{error}</div>}
            {!loading && !error && (
              <>
                <SimpleListItem
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
                    <SimpleListItem
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
          <div className={`mixer-theme ${styles.mixerColumn}`}>
            <Mixer1Channel state={audioState} />
          </div>
        </div>
      </div>
    </div>
  );
}
