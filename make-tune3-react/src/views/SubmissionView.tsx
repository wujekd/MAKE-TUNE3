import { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AudioEngineContext } from '../audio-services/AudioEngineContext';
import { useAppStore } from '../stores/appStore';
import { Mixer } from '../components/Mixer';
import './MainView.css';
import { AnalogVUMeter } from '../components/AnalogVUMeter';
import ProjectHistory from '../components/ProjectHistory';
import '../components/ProjectHistory.css';
import { CollaborationService } from '../services/collaborationService';
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
  const state = useAppStore(s => s.audio.state) as any;
  usePrefetchAudio(backingUrl);
  useEffect(() => {
    if (!audioContext?.engine || !backingUrl) return;
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
      await CollaborationService.uploadSubmission(file, currentCollaboration.id, user.uid, undefined, (p) => setProgress(p));
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

  // no auto-load/play; backing will be set on first preview request

  if (!audioContext) return <div>audio engine not available</div>;

  return (
    <div className="main-container">
      

      <div className="info-top">
        <div className="abs-tl mt-16 ml-16 z-1000">
          <button onClick={() => (window.location.href = '/collabs')} className="btn btn--secondary">← back to collabs</button>
        </div>
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
          <div className="audio-player-title">Upload</div>
          <div className="submissions-scroll">
            <div className="row gap-16 wrap">
              <div className="card" style={{ maxWidth: 560 }}>
                <h4 className="card__title">Upload your submission</h4>
                <div className="card__body">
                  <div className="mb-8" style={{ color: 'var(--white)', opacity: 0.8 }}>Choose an audio file to submit to the current collaboration</div>
                  <input type="file" accept="audio/*" onChange={(e) => setFile(e.target.files?.[0] || null)} />
                  <div className="row gap-8 mt-8" style={{ justifyContent: 'flex-start', alignItems: 'center' }}>
                    <button onClick={onUpload} disabled={saving || !file || !user || alreadySubmitted}>{saving ? `uploading ${progress}%` : 'upload'}</button>
                    {saving && (
                      <div style={{ width: 180, height: 8, background: 'rgba(255,255,255,0.15)', borderRadius: 4 }}>
                        <div style={{ width: `${progress}%`, height: '100%', background: 'var(--contrast-600)', borderRadius: 4 }} />
                      </div>
                    )}
                    {!DEBUG_ALLOW_MULTIPLE_SUBMISSIONS && alreadySubmitted && <div style={{ color: 'var(--white)' }}>you already submitted to this collaboration</div>}
                    {!user && <div style={{ color: 'var(--white)' }}>login required</div>}
                  </div>
                  {error && <div className="mt-8" style={{ color: 'var(--white)' }}>{error}</div>}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {state && <Mixer state={state} />}
    </div>
  );
}

