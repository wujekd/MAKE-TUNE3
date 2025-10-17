import { useContext, useEffect, useRef, useState } from 'react';
import { AudioEngineContext } from '../audio-services/AudioEngineContext';
import { useAppStore } from '../stores/appStore';
import { Mixer } from '../components/Mixer';
import './MainView.css';
import ProjectHistory from '../components/ProjectHistory';
import '../components/ProjectHistory.css';
import { CollaborationService } from '../services/collaborationService';
import { DownloadBacking } from '../components/DownloadBacking';
import { UploadSubmission } from '../components/UploadSubmission';
import { storage } from '../services/firebase';
import { ref, getDownloadURL } from 'firebase/storage';
import { useParams } from 'react-router-dom';
import { usePrefetchAudio } from '../hooks/usePrefetchAudio';
import '../components/Favorites.css';

export function SubmissionView() {
  const audioContext = useContext(AudioEngineContext);
  const { user } = useAppStore(s => s.auth);
  const { currentCollaboration, loadCollaboration, loadCollaborationAnonymousById } = useAppStore(s => s.collaboration);
  const { collaborationId } = useParams();

  const [backingUrl, setBackingUrl] = useState<string>('');
  const pendingBackingUrlRef = useRef<string>('');
  const state = useAppStore(s => s.audio.state) as any;
  const [hasDownloaded, setHasDownloaded] = useState<boolean>(true);
  const [hasSubmitted, setHasSubmitted] = useState<boolean>(false);
  usePrefetchAudio(backingUrl);
  useEffect(() => {
    if (!audioContext?.engine || !backingUrl) return;
    pendingBackingUrlRef.current = backingUrl;
    audioContext.engine.preloadBacking(backingUrl);
  }, [audioContext?.engine, backingUrl]);

  // resolve backing track URL when collaboration changes
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
      const backingUrl = pendingBackingUrlRef.current;
      if (backingUrl) engine.preloadBacking(backingUrl);
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

  useEffect(() => {
    (async () => {
      if (!user || !currentCollaboration) { setHasDownloaded(true); return; }
      const ok = await CollaborationService.hasDownloadedBacking(user.uid, currentCollaboration.id);
      setHasDownloaded(ok);
    })();
  }, [user?.uid, currentCollaboration?.id]);

  useEffect(() => {
    (async () => {
      if (!user || !currentCollaboration) { setHasSubmitted(false); return; }
      const submitted = await CollaborationService.hasUserSubmitted(currentCollaboration.id, user.uid);
      setHasSubmitted(submitted);
    })();
  }, [user?.uid, currentCollaboration?.id]);

  if (!audioContext) return <div>audio engine not available</div>;

  return (
    <div className="main-container">
      

      <div className="info-top">
        <h2>Submission</h2>
        <ProjectHistory />
      </div>

      <div className="submissions-section active-playback">
        <div className="audio-player-section">
          <div className="audio-player-title">
            {hasSubmitted ? 'Already submitted' : hasDownloaded ? 'Upload' : 'Download'}
          </div>
          <div className="submissions-scroll">
            {hasSubmitted && user && (
              <div className="card" style={{ maxWidth: 560 }}>
                <h4 className="card__title">Submission complete</h4>
                <div className="card__body">
                  <div style={{ color: 'var(--white)', opacity: 0.8 }}>
                    You have already submitted to this collaboration.
                  </div>
                </div>
              </div>
            )}
            {!hasSubmitted && !hasDownloaded && user && currentCollaboration && currentCollaboration.backingTrackPath && (
              <DownloadBacking userId={user.uid} collaborationId={currentCollaboration.id} backingPath={currentCollaboration.backingTrackPath} onDownloaded={() => setHasDownloaded(true)} />
            )}
            {!hasSubmitted && (hasDownloaded || !user) && collaborationId && (
              <UploadSubmission collaborationId={collaborationId} backingUrl={backingUrl} />
            )}
          </div>
        </div>
      </div>

      {state && <Mixer state={state} />}
    </div>
  );
}