import { useContext, useEffect, useRef, useState, useCallback } from 'react';
import { AudioEngineContext } from '../audio-services/AudioEngineContext';
import { useAppStore } from '../stores/appStore';
import { useAudioStore } from '../stores';
import { Mixer } from '../components/Mixer';
import './MainView.css';
import ProjectHistory from '../components/ProjectHistory';
import '../components/ProjectHistory.css';
import { CollabHeader } from '../components/CollabHeader';
import { UserService, SubmissionService, ProjectService } from '../services';
import { DownloadBacking } from '../components/DownloadBacking';
import { UploadSubmission } from '../components/UploadSubmission';
import { storage } from '../services/firebase';
import { ref, getDownloadURL } from 'firebase/storage';
import { useParams, useNavigate } from 'react-router-dom';
import { usePrefetchAudio } from '../hooks/usePrefetchAudio';
import '../components/Favorites.css';

export function SubmissionView() {
  const audioContext = useContext(AudioEngineContext);
  const { user } = useAppStore(s => s.auth);
  const { currentCollaboration, loadCollaboration, loadCollaborationAnonymousById } = useAppStore(s => s.collaboration);
  const { collaborationId } = useParams();

  const [backingUrl, setBackingUrl] = useState<string>('');
  const pendingBackingUrlRef = useRef<string>('');
  const stageCheckInFlightRef = useRef(false);
  const state = useAudioStore(s => s.state) as any;
  const [projectInfo, setProjectInfo] = useState<{ name: string; description: string } | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'downloaded' | 'submitted'>('loading');
  const navigate = useNavigate();

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
        if (path.startsWith('/test-audio/')) { if (!cancelled) setBackingUrl(path); return; }
        if (!path.startsWith('collabs/')) { if (!cancelled) setBackingUrl(`/test-audio/${path}`); return; }
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
    if (user) loadCollaboration(user.uid, collaborationId);
    else loadCollaborationAnonymousById(collaborationId);
  }, [collaborationId, user, loadCollaboration, loadCollaborationAnonymousById]);

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
      if (user) {
        await loadCollaboration(user.uid, current.id);
      } else {
        await loadCollaborationAnonymousById(current.id);
      }
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
  }, [user, loadCollaboration, loadCollaborationAnonymousById, navigate]);

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
      if (!user || !currentCollaboration) {
        setStatus('ready');
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
      } catch (e) {
        console.error('failed to resolve submission status', e);
        setStatus('ready');
      }
    })();
  }, [user?.uid, currentCollaboration?.id]);

  if (!audioContext) return <div>audio engine not available</div>;

  const renderPane = () => {
    if (status === 'loading') {
      return (
        <div className="submission-pane">
          <h4 className="card__title">Preparing submission flow</h4>
          <div className="card__body">
            <div style={{ color: 'var(--white)', opacity: 0.8 }}>
              Checking your download and submission status...
            </div>
          </div>
        </div>
      );
    }

    if (status === 'submitted' && user) {
      return (
        <div className="submission-pane">
          <h4 className="card__title">Submission complete</h4>
          <div className="card__body">
            <div style={{ color: 'var(--white)', opacity: 0.8 }}>
              You have already submitted to this collaboration.
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
    <div className="main-container">
      <div className="info-top" style={{ maxHeight: '200px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'stretch', width: '100%', gap: 16, height: '100%', minHeight: 0 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {projectInfo && (
              <div style={{ marginBottom: 8, color: 'var(--white)', opacity: 0.85 }}>
                <div style={{ fontSize: 20, fontWeight: 600 }}>{projectInfo.name}</div>
                {projectInfo.description && (
                  <div style={{ fontSize: 13, opacity: 0.75 }}>{projectInfo.description}</div>
                )}
              </div>
            )}
            <h2 style={{ color: 'var(--white)', margin: 0 }}>{currentCollaboration?.name || 'Submission'}</h2>
          </div>
          <ProjectHistory />
          <div style={{ minWidth: 0 }}>
            <CollabHeader collaboration={currentCollaboration} onStageChange={handleStageChange} />
          </div>
        </div>
      </div>

      <div className="submissions-section active-playback">
        <div className="audio-player-section">
          <div className="submission-pane-wrapper">
            {renderPane()}
          </div>
        </div>
      </div>

      {state && <Mixer state={state} />}
    </div>
  );
}
