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
import { UserService, ProjectService } from '../services';
import { SubmissionService } from '../services/submissionService';
import { DownloadBacking } from '../components/DownloadBacking';
import { UploadSubmission } from '../components/UploadSubmission';
import { resolveStorageDownloadUrl } from '../services/storageService';
import { useParams, useNavigate } from 'react-router-dom';
import { usePrefetchAudio } from '../hooks/usePrefetchAudio';
import { useCollaborationLoader } from '../hooks/useCollaborationLoader';
import { useStageRedirect } from '../hooks/useStageRedirect';
import '../components/Favorites.css';
import styles from './SubmissionView.module.css';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { MissingCollaborationState } from '../components/MissingCollaborationState';
import { CollaborationPreferenceBar } from '../components/CollaborationPreferenceBar';

export function SubmissionView() {
  const audioContext = useContext(AudioEngineContext);
  const { user, loading: authLoading } = useAppStore(s => s.auth);
  const userId = user?.uid ?? null;
  const {
    currentCollaboration,
    userCollaboration,
    refreshCollaborationStatus,
    likeCollaboration,
    unlikeCollaboration,
    favoriteCollaboration,
    unfavoriteCollaboration,
    isUpdatingCollaborationLike,
    isUpdatingCollaborationFavorite
  } = useAppStore(s => s.collaboration);
  const { collaborationId } = useParams();
  const loader = useCollaborationLoader(collaborationId);
  const requestedCollaboration = currentCollaboration?.id === collaborationId ? currentCollaboration : null;

  const [backingUrl, setBackingUrl] = useState<string>('');
  const pendingBackingUrlRef = useRef<string>('');
  const stageCheckInFlightRef = useRef(false);
  const state = useAudioStore(s => s.state) as any;
  const [projectInfo, setProjectInfo] = useState<{ name: string; description: string } | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'downloaded' | 'submitted'>('loading');
  const [resolvedStatusKey, setResolvedStatusKey] = useState<string | null>(null);
  const navigate = useNavigate();
  const timelineStatus = requestedCollaboration?.status ?? 'submission';

  const effectiveSubmissionLimit = typeof requestedCollaboration?.effectiveSubmissionLimit === 'number'
    ? requestedCollaboration.effectiveSubmissionLimit
    : null;
  const submissionsUsed = typeof requestedCollaboration?.submissionsUsedCount === 'number'
    ? requestedCollaboration.submissionsUsedCount
    : (typeof requestedCollaboration?.submissionsCount === 'number' ? requestedCollaboration.submissionsCount : 0);
  const limitReached = effectiveSubmissionLimit !== null && submissionsUsed >= effectiveSubmissionLimit;

  useStageRedirect({
    expected: 'submission',
    collaboration: requestedCollaboration,
    collabId: collaborationId,
    navigate
  });

  usePrefetchAudio(backingUrl);

  useEffect(() => {
    if (!audioContext?.engine || !backingUrl) return;
    pendingBackingUrlRef.current = backingUrl;
    audioContext.engine.preloadBacking(backingUrl);
  }, [audioContext?.engine, backingUrl]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const path = requestedCollaboration?.backingTrackPath || '';
      if (!path) { if (!cancelled) setBackingUrl(''); return; }
      try {
        if (!path.startsWith('collabs/')) { if (!cancelled) setBackingUrl(path); return; }
        const url = await resolveStorageDownloadUrl(path);
        if (!cancelled) setBackingUrl(url);
      } catch {
        if (!cancelled) setBackingUrl('');
      }
    })();
    return () => { cancelled = true; };
  }, [requestedCollaboration?.backingTrackPath]);

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
    if (!collaborationId || requestedCollaboration?.id !== collaborationId) return;
    refreshCollaborationStatus(collaborationId);
  }, [collaborationId, requestedCollaboration?.id, refreshCollaborationStatus]);

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
      if (!requestedCollaboration?.projectId) {
        setProjectInfo(null);
        return;
      }
      try {
        const project = await ProjectService.getProject(requestedCollaboration.projectId);
        if (project) {
          setProjectInfo({ name: project.name, description: project.description });
        }
      } catch {
        setProjectInfo(null);
      }
    })();
  }, [requestedCollaboration?.projectId]);

  useEffect(() => {
    (async () => {
      setStatus('loading');
      setResolvedStatusKey(null);
      if (!collaborationId || requestedCollaboration?.id !== collaborationId) {
        return;
      }
      if (authLoading) {
        return;
      }
      if (!userId) {
        setStatus('ready');
        setResolvedStatusKey(`anon:${collaborationId}`);
        return;
      }
      try {
        const [downloaded, submitted] = await Promise.all([
          UserService.hasDownloadedBacking(userId, requestedCollaboration.id),
          SubmissionService.hasUserSubmitted(requestedCollaboration.id, userId)
        ]);
        if (submitted) {
          setStatus('submitted');
        } else if (downloaded) {
          setStatus('downloaded');
        } else {
          setStatus('ready');
        }
        setResolvedStatusKey(`${userId ?? 'anon'}:${collaborationId}`);
      } catch (e) {
        console.error('failed to resolve submission status', e);
        setStatus('ready');
        setResolvedStatusKey(`${userId ?? 'anon'}:${collaborationId}`);
      }
    })();
  }, [userId, requestedCollaboration?.id, collaborationId, authLoading]);

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

  if (loader.status === 'not_found') {
    return <MissingCollaborationState collaborationId={collaborationId} viewLabel="submission view" />;
  }

  if (!audioContext) return <div>audio engine not available</div>;

  const isCollabReady = Boolean(collaborationId && requestedCollaboration?.id === collaborationId);
  const statusKey = `${user?.uid ?? 'anon'}:${collaborationId ?? 'none'}`;
  const isStatusResolved = isCollabReady && !authLoading && resolvedStatusKey === statusKey;

  if (loader.status === 'loading' || !isCollabReady) {
    return (
      <div className={`view-container ${styles.container}`}>
        <div className={styles.content}>
          <div className={styles.submissionsSection}>
            <div className={styles.submissionPaneWrapper}>
              <div className={styles.submissionPane}>
                <div className={styles.loadingSpinnerWrap}>
                  <LoadingSpinner size={32} />
                </div>
              </div>
            </div>
          </div>

          <div className={`mixer-theme ${styles.mixerSection}`}>
            {state && <Mixer state={state} />}
          </div>
        </div>
      </div>
    );
  }

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

    if (status === 'ready' && user && requestedCollaboration?.backingTrackPath) {
      return (
        <DownloadBacking
          userId={user.uid}
          collaborationId={requestedCollaboration.id}
          backingPath={requestedCollaboration.backingTrackPath}
          pdfPath={requestedCollaboration.pdfPath}
          resourcesZipPath={requestedCollaboration.resourcesZipPath}
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
    <div className={`view-container ${styles.container}`}>
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
          <h2 className={styles.collabTitle}>{requestedCollaboration?.name || 'Submission'}</h2>
          <CollaborationPreferenceBar
            disabled={!user}
            liked={Boolean(userCollaboration?.likedCollaboration)}
            favorited={Boolean(userCollaboration?.favoritedCollaboration)}
            isUpdatingLike={isUpdatingCollaborationLike}
            isUpdatingFavorite={isUpdatingCollaborationFavorite}
            onToggleLike={() => {
              if (userCollaboration?.likedCollaboration) {
                unlikeCollaboration();
              } else {
                likeCollaboration();
              }
            }}
            onToggleFavorite={() => {
              if (userCollaboration?.favoritedCollaboration) {
                unfavoriteCollaboration();
              } else {
                favoriteCollaboration();
              }
            }}
          />
        </div>
        <div className={styles.headerRight}>
          <ProjectHistory />
          <CollabData collab={requestedCollaboration as any} />
          <CollabHeader
            collaboration={requestedCollaboration}
            onStageChange={handleStageChange}
            displayStatus={timelineStatus}
          />
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

        <div className={`mixer-theme ${styles.mixerSection}`}>
          {state && <Mixer state={state} />}
        </div>
      </div>
    </div>
  );
}
