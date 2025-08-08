import { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AudioEngineContext } from '../audio-services/AudioEngineContext';
import { useAppStore } from '../stores/appStore';
import { Mixer } from '../components/Mixer';
import './MainView.css';
import { AnalogVUMeter } from '../components/AnalogVUMeter';
import { CollaborationService } from '../services/collaborationService';
import { useParams } from 'react-router-dom';

export function SubmissionView() {
  const audioContext = useContext(AudioEngineContext);
  const { user } = useAppStore(s => s.auth);
  const { currentCollaboration, loadCollaboration, loadCollaborationAnonymousById } = useAppStore(s => s.collaboration);
  const { collaborationId } = useParams();

  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const state = useAppStore(s => s.audio.state) as any;

  const onUpload = async () => {
    if (!file || !currentCollaboration || !user) { setError('missing file or auth'); return; }
    setSaving(true); setError(null);
    try {
      await CollaborationService.uploadSubmission(file, currentCollaboration.id, user.uid);
      setFile(null);
    } catch (e: any) {
      setError(e?.message || 'upload failed');
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!collaborationId) return;
    if (user) loadCollaboration(user.uid, collaborationId);
    else loadCollaborationAnonymousById(collaborationId);
  }, [collaborationId, user, loadCollaboration, loadCollaborationAnonymousById]);

  // load backing track into player2 like in main view (past stage playback)
  const lastBackingRef = useRef<string | null>(null);
  useEffect(() => {
    if (!audioContext?.engine) return;
    const path = currentCollaboration?.backingTrackPath;
    if (!path) return;
    // construct local path if needed
    const full = path.startsWith('/test-audio/') ? path : `/test-audio/${path}`;
    if (lastBackingRef.current === full) return;
    lastBackingRef.current = full;
    audioContext.engine.playPastStage(full, 0);
  }, [audioContext?.engine, currentCollaboration?.backingTrackPath]);

  if (!audioContext) return <div>audio engine not available</div>;

  return (
    <div className="main-container">
      <div style={{ position: 'absolute', top: 16, left: 16, zIndex: 1000 }}>
        <button onClick={() => (window.location.href = '/collabs')}>← back to collabs</button>
      </div>

      <div className="info-top">
        <h2>submission stage</h2>
        <div style={{ color: 'var(--white)' }}>{currentCollaboration?.name}</div>
      </div>

      <div className="submissions-section active-playback">
        <div className="audio-player-section">
          <div className="audio-player-title">upload your submission</div>
          <div style={{ color: 'var(--white)', opacity: 0.8, marginBottom: 8 }}>choose an audio file to submit to the current collaboration</div>
          <input type="file" accept="audio/*" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button onClick={onUpload} disabled={saving || !file || !user}> {saving ? 'uploading...' : 'upload'} </button>
            {!user && <div style={{ color: 'var(--white)' }}>login required</div>}
          </div>
          {error && <div style={{ color: 'var(--white)', marginTop: 8 }}>{error}</div>}
        </div>
      </div>

      {state && <Mixer state={state} />}
    </div>
  );
}

