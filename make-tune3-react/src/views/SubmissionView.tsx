import { useContext, useEffect, useRef, useState, useCallback } from 'react';
import { AudioEngineContext } from '../audio-services/AudioEngineContext';
import { useAppStore } from '../stores/appStore';
import { useAudioStore } from '../stores';
import { Mixer } from '../components/Mixer';
import './MainView.css';
import ProjectHistory from '../components/ProjectHistory';
import '../components/ProjectHistory.css';
import { CollabData } from '../components/CollabData';
import { CollabHeader } from '../components/CollabHeader';
import { UserService, SubmissionService, ProjectService } from '../services';
import { DownloadBacking } from '../components/DownloadBacking';
import { UploadSubmission } from '../components/UploadSubmission';
import { storage } from '../services/firebase';
import { ref, getDownloadURL } from 'firebase/storage';
import { useParams, useNavigate } from 'react-router-dom';
import { usePrefetchAudio } from '../hooks/usePrefetchAudio';
import '../components/Favorites.css';
import styles from './SubmissionView.module.css';
import { LoadingSpinner } from '../components/LoadingSpinner';

export function SubmissionView() {
  const audioContext = useContext(AudioEngineContext);
  const { user, loading: authLoading } = useAppStore(s => s.auth);
  const { currentCollaboration, refreshCollaborationStatus } = useAppStore(s => s.collaboration);
  const { collaborationId } = useParams();

  const [backingUrl, setBackingUrl] = useState<string>('');
  const pendingBackingUrlRef = useRef<string>('');
  const stageCheckInFlightRef = useRef(false);
  const state = useAudioStore(s => s.state) as any;
  const [projectInfo, setProjectInfo] = useState<{ name: string; description: string } | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'downloaded' | 'submitted'>('loading');
  const [resolvedStatusKey, setResolvedStatusKey] = useState<string | null>(null);
  const navigate = useNavigate();

  const effectiveSubmissionLimit = typeof currentCollaboration?.effectiveSubmissionLimit === 'number'
    ? currentCollaboration.effectiveSubmissionLimit
    : null;
  const submissionsUsed = typeof currentCollaboration?.submissionsUsedCount === 'number'
    ? currentCollaboration.submissionsUsedCount
    : (typeof currentCollaboration?.submissionsCount === 'number' ? currentCollaboration.submissionsCount : 0);
  const limitReached = effectiveSubmissionLimit !== null && submissionsUsed >= effectiveSubmissionLimit;

  usePrefetchAudio(backingUrl);

  useEffect(() => {
    if (!audioContext?.engine || !backingUrl) return;
    pendingBackingUrlRef.current = backingUrl;
    audioContext.engine.preloadBacking(backingUrl);
  }, [audioContext?.engine, backingUrl]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const path = currentCollaboration?.backingTrackPath || '';
      if (!path) { if (!cancelled) setBackingUrl(''); return; }
      try {
        if (!path.startsWith('collabs/')) { if (!cancelled) setBackingUrl(path); return; }
        const url = await getDownloadURL(ref(storage, path));
        if (!cancelled) setBackingUrl(url);
      } catch (e) {
        if (!cancelled) setBackingUrl('');
      }
    })();
    return () => { cancelled = true; };
  }, [currentCollaboration?.backingTrackPath]);

  useEffect(() => {
    const engine = audioContext?.engine;
    if (!engine) return;
    const handler = async () => {
      await engine.unlock?.();
      const url = pendingBackingUrlRef.current;
      if (url) engine.preloadBacking(url);
    };
    window.addEventListener('pointerdown', handler, { once: true });
    window.addEventListener('keydown', handler, { once: true });
    return () => {
      window.removeEventListener('pointerdown', handler as any);
      window.removeEventListener('keydown', handler as any);
    };
  }, [audioContext?.engine]);

  useEffect(() => {
    if (!collaborationId) return;
    refreshCollaborationStatus(collaborationId);
  }, [collaborationId, refreshCollaborationStatus]);

  // Redirect if collaboration is in wrong stage
  useEffect(() => {
    if (!currentCollaboration || !collaborationId) return;

    const collabStatus = currentCollaboration.status;

    if (collabStatus === 'voting') {
      console.log('[SubmissionView] Collaboration is in voting stage, redirecting...');
      navigate(`/collab/${collaborationId}`, { replace: true });
    } else if (collabStatus === 'completed') {
      console.log('[SubmissionView] Collaboration is in completed stage, redirecting...');
      navigate(`/collab/${collaborationId}/completed`, { replace: true });
    }
  }, [currentCollaboration, collaborationId, navigate]);

  const handleStageChange = useCallback(async (nextStatus: 'voting' | 'completed') => {
    if (stageCheckInFlightRef.current) {
      return;
    }
    stageCheckInFlightRef.current = true;
    console.log(`[SubmissionView] stage change to ${nextStatus} detected`);
    try {
      const current = useAppStore.getState().collaboration.currentCollaboration;
      if (!current) return;
      await refreshCollaborationStatus(current.id);
      const updated = useAppStore.getState().collaboration.currentCollaboration;
      if (updated?.status === nextStatus) {
        if (nextStatus === 'voting') {
          setStatus('loading');
          navigate(`/collab/${updated.id}`);
        } else if (nextStatus === 'completed') {
          setStatus('loading');
          navigate(`/collab/${updated.id}/completed`);
        }
      }
    } catch (err) {
      console.warn('[SubmissionView] stage change refresh failed', err);
    } finally {
      stageCheckInFlightRef.current = false;
    }
  }, [refreshCollaborationStatus, navigate]);

  useEffect(() => {
    (async () => {
      if (!currentCollaboration?.projectId) {
        setProjectInfo(null);
        return;
      }
      try {
        const project = await ProjectService.getProject(currentCollaboration.projectId);
        if (project) {
          setProjectInfo({ name: project.name, description: project.description });
        }
      } catch {
        setProjectInfo(null);
      }
    })();
  }, [currentCollaboration?.projectId]);

  useEffect(() => {
    (async () => {
      setStatus('loading');
      setResolvedStatusKey(null);
      if (!collaborationId || currentCollaboration?.id !== collaborationId) {
        return;
      }
      if (authLoading) {
        return;
      }
      if (!user) {
        setStatus('ready');
        setResolvedStatusKey(`${user?.uid ?? 'anon'}:${collaborationId}`);
        return;
      }
      try {
        const [downloaded, submitted] = await Promise.all([
          UserService.hasDownloadedBacking(user.uid, currentCollaboration.id),
          SubmissionService.hasUserSubmitted(currentCollaboration.id, user.uid)
        ]);
        if (submitted) {
          setStatus('submitted');
        } else if (downloaded) {
          setStatus('downloaded');
        } else {
          setStatus('ready');
        }
        setResolvedStatusKey(`${user?.uid ?? 'anon'}:${collaborationId}`);
      } catch (e) {
        console.error('failed to resolve submission status', e);
        setStatus('ready');
        setResolvedStatusKey(`${user?.uid ?? 'anon'}:${collaborationId}`);
      }
    })();
  }, [user?.uid, currentCollaboration?.id, collaborationId, authLoading]);

  useEffect(() => {
    if (status !== 'submitted') return;
    audioContext?.engine?.clearSubmissionSource();
  }, [status, audioContext?.engine]);

  useEffect(() => {
    if (!audioContext?.engine) return;
    return () => {
      audioContext.engine.clearPlaybackSources();
    };
  }, [audioContext?.engine]);

  if (!audioContext) return <div>audio engine not available</div>;

  const isCollabReady = Boolean(collaborationId && currentCollaboration?.id === collaborationId);
  const statusKey = `${user?.uid ?? 'anon'}:${collaborationId ?? 'none'}`;
  const isStatusResolved = isCollabReady && !authLoading && resolvedStatusKey === statusKey;

  const renderPane = () => {
    if (!isStatusResolved || status === 'loading') {
      return (
        <div className={styles.submissionPane}>
          <div className={styles.loadingSpinnerWrap}>
            <LoadingSpinner size={32} />
          </div>
        </div>
      );
    }

    if (status === 'submitted' && user) {
      return (
        <div className={styles.submissionPane}>
          <div className={styles.statusCentered}>
            <h4 className={styles.cardTitle}>Submission complete</h4>
            <div className={styles.statusMessage}>
              You have already submitted to this collaboration.
            </div>
          </div>
        </div>
      );
    }

    if (limitReached) {
      return (
        <div className={styles.submissionPane}>
          <div className={styles.statusCentered}>
            <h4 className={styles.cardTitle}>Submissions full</h4>
            <div className={styles.statusMessage}>
              This collaboration has reached its submission limit.
            </div>
          </div>
        </div>
      );
    }

    if (status === 'ready' && user && currentCollaboration?.backingTrackPath) {
      return (
        <DownloadBacking
          userId={user.uid}
          collaborationId={currentCollaboration.id}
          backingPath={currentCollaboration.backingTrackPath}
          pdfPath={currentCollaboration.pdfPath}
          resourcesZipPath={currentCollaboration.resourcesZipPath}
          onDownloaded={() => setStatus('downloaded')}
        />
      );
    }

    if (status === 'downloaded' && collaborationId) {
      return (
        <UploadSubmission
          collaborationId={collaborationId}
          backingUrl={backingUrl}
          onSubmitSuccess={() => setStatus('submitted')}
        />
      );
    }

    if (!user && collaborationId) {
      return (
        <UploadSubmission
          collaborationId={collaborationId}
          backingUrl={backingUrl}
          onSubmitSuccess={() => setStatus('submitted')}
        />
      );
    }

    return null;
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          {projectInfo && (
            <div className={styles.projectMeta}>
              <h3 className={styles.projectName}>{projectInfo.name}</h3>
              {projectInfo.description && (
                <p className={styles.projectDescription}>{projectInfo.description}</p>
              )}
            </div>
          )}
          <h2 className={styles.collabTitle}>{currentCollaboration?.name || 'Submission'}</h2>
        </div>
        <div className={styles.headerRight}>
          <ProjectHistory />
          <CollabData collab={currentCollaboration as any} />
          <CollabHeader collaboration={currentCollaboration} onStageChange={handleStageChange} />
        </div>
      </div>

      <div className={styles.content}>
        <div className={styles.submissionsSection}>
          <div className={styles.submissionsHeader}>
            <div className={styles.submissionsCounter}>
              Submissions {submissionsUsed}{effectiveSubmissionLimit !== null ? ` / ${effectiveSubmissionLimit}` : ''}
            </div>
          </div>
          <div className={styles.submissionPaneWrapper}>
            {renderPane()}
          </div>
        </div>

        <div className={styles.mixerSection}>
          {state && <Mixer state={state} />}
        </div>
      </div>
    </div>
  );
}
