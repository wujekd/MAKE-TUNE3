import { useContext, useEffect, useMemo, useRef, useState } from 'react';
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
import { DEBUG_ALLOW_MULTIPLE_SUBMISSIONS } from '../config';
import { usePrefetchAudio } from '../hooks/usePrefetchAudio';
import '../components/Favorites.css';

export function SubmissionView() {
  const audioContext = useContext(AudioEngineContext);
  const { user } = useAppStore(s => s.auth);
  const { currentCollaboration, loadCollaboration, loadCollaborationAnonymousById } = useAppStore(s => s.collaboration);
  const { collaborationId } = useParams();

  const [file, setFile] = useState<File | null>(null);
  const blobUrlRef = useRef<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<number>(0);
  const [backingUrl, setBackingUrl] = useState<string>('');
  const pendingBackingUrlRef = useRef<string>('');
  const state = useAppStore(s => s.audio.state) as any;
  const [hasDownloaded, setHasDownloaded] = useState<boolean>(true);
  usePrefetchAudio(backingUrl);
  useEffect(() => {
    if (!audioContext?.engine || !backingUrl) return;
    pendingBackingUrlRef.current = backingUrl;
    audioContext.engine.preloadBacking(backingUrl);
  }, [audioContext?.engine, backingUrl]);

  const alreadySubmitted = useMemo(() => {
    if (DEBUG_ALLOW_MULTIPLE_SUBMISSIONS) return false;
    if (!user || !currentCollaboration) return false;
    const list = (currentCollaboration as any).participantIds as string[] | undefined;
    return Array.isArray(list) && list.includes(user.uid);
  }, [user, currentCollaboration]);

  const onUpload = async () => {
    if (!file || !currentCollaboration || !user) { setError('missing file or auth'); return; }
    if (!DEBUG_ALLOW_MULTIPLE_SUBMISSIONS && alreadySubmitted) { setError('you already submitted'); return; }
    setSaving(true); setError(null); setProgress(0);
    try {
      const eqState = (audioContext?.engine?.getState?.() as any)?.eq;
      const p1Vol = (audioContext?.engine?.getState?.() as any)?.player1?.volume ?? 1;
      const settings = {
        eq: {
          highshelf: { gain: eqState?.highshelf?.gain ?? 0, frequency: eqState?.highshelf?.frequency ?? 8000 },
          param2: { gain: eqState?.param2?.gain ?? 0, frequency: eqState?.param2?.frequency ?? 3000, Q: eqState?.param2?.Q ?? 1 },
          param1: { gain: eqState?.param1?.gain ?? 0, frequency: eqState?.param1?.frequency ?? 250, Q: eqState?.param1?.Q ?? 1 },
          highpass: { frequency: eqState?.highpass?.frequency ?? 20, enabled: true }
        },
        volume: { gain: p1Vol }
      } as any;
      await CollaborationService.uploadSubmission(file, currentCollaboration.id, user.uid, undefined, (p) => setProgress(p), settings);
      setFile(null);
      await loadCollaboration(user.uid, currentCollaboration.id);
    } catch (e: any) {
      setError(e?.message || 'upload failed');
    } finally {
      setSaving(false);
    }
  };

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

  // manage blob url lifecycle only (no auto-play)
  useEffect(() => {
    if (!file) {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
      return;
    }
    const url = URL.createObjectURL(file);
    blobUrlRef.current = url;
    return () => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, [file]);

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

  // no auto-load/play; backing will be set on first preview request

  if (!audioContext) return <div>audio engine not available</div>;

  return (
    <div className="main-container">
      

      <div className="info-top">
        <h2>Submission</h2>
        <ProjectHistory />
      </div>

      <div className="submissions-section active-playback">
        <div className="audio-player-section">
          {/* Top block styled like Favorites */}
          <section className="favorites-section">
            <div className="favorites-header">
              <h2 className="favorites-title">Submission check</h2>
            </div>
            <div className="favorites-container">
              <div className="favorite-item favorite-placeholder" style={{ outline: '1px dashed rgba(255,255,255,0.2)' }}>
                <div style={{ color: 'var(--white)', opacity: 0.8 }}>
                  {file ? `selected: ${file.name}` : 'no file selected'}
                </div>
                <div className="row gap-8 mt-8" style={{ alignItems: 'center' }}>
                  <button
                    onClick={() => {
                      if (!audioContext?.engine || !currentCollaboration || !file) return;
                      const isPlaying = !!(state && state.player1 && state.player1.isPlaying);
                      if (isPlaying) {
                        audioContext.engine.stopPreview();
                      } else {
                        let blobUrl = blobUrlRef.current;
                        if (!blobUrl) {
                          blobUrl = URL.createObjectURL(file);
                          blobUrlRef.current = blobUrl;
                        }
                        if (!backingUrl) return;
                        audioContext.engine.previewSubmission(blobUrl, backingUrl);
                      }
                    }}
                    disabled={!file || !backingUrl}
                  >
                    {state?.player1?.isPlaying ? 'pause' : 'play'}
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* Title and scroll area mirrors MainView submissions list */}
          <div className="audio-player-title">{hasDownloaded ? 'Upload' : 'Download'}</div>
          <div className="submissions-scroll">
            <div className="row gap-16 wrap">
              {!hasDownloaded && user && currentCollaboration && currentCollaboration.backingTrackPath && (
                <DownloadBacking userId={user.uid} collaborationId={currentCollaboration.id} backingPath={currentCollaboration.backingTrackPath} onDownloaded={() => setHasDownloaded(true)} />
              )}
              {(hasDownloaded || !user) && collaborationId && (
                <UploadSubmission collaborationId={collaborationId} backingUrl={backingUrl} />
              )}
            </div>
          </div>
        </div>
      </div>

      {state && <Mixer state={state} />}
    </div>
  );
}

