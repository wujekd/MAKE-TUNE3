import { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AudioEngineContext } from '../audio-services/AudioEngineContext';
import { useAppStore } from '../stores/appStore';
import { Mixer } from '../components/Mixer';
import './MainView.css';
import { AnalogVUMeter } from '../components/AnalogVUMeter';
import ProjectHistory from '../components/ProjectHistory';
import '../components/ProjectHistory.css';
import { CollaborationService } from '../services/collaborationService';
import { useParams } from 'react-router-dom';

export function SubmissionView() {
  const audioContext = useContext(AudioEngineContext);
  const { user } = useAppStore(s => s.auth);
  const { currentCollaboration, loadCollaboration, loadCollaborationAnonymousById } = useAppStore(s => s.collaboration);
  const { collaborationId } = useParams();

  const [file, setFile] = useState<File | null>(null);
  const blobUrlRef = useRef<string | null>(null);
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
      <div style={{ position: 'absolute', top: 16, left: 16, zIndex: 1000 }}>
        <button onClick={() => (window.location.href = '/collabs')}>← back to collabs</button>
      </div>

      <div className="info-top">
        <h2>submission stage</h2>
        <ProjectHistory />
      </div>

      <div className="submissions-section active-playback">
        <div style={{ padding: '1rem' }}>
          <div className="project-history" style={{ maxWidth: 560 }}>
            <h4 className="project-history-title">upload your submission</h4>
            <div className="collab-list">
              <div style={{ color: 'var(--white)', opacity: 0.8, marginBottom: 8 }}>choose an audio file to submit to the current collaboration</div>
              <input type="file" accept="audio/*" onChange={(e) => setFile(e.target.files?.[0] || null)} />
              <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
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
                      const backing = currentCollaboration.backingTrackPath;
                      const backingFull = backing.startsWith('/test-audio/') ? backing : `/test-audio/${backing}`;
                      audioContext.engine.previewSubmission(blobUrl, backingFull);
                    }
                  }}
                  disabled={!file}
                >
                  {state?.player1?.isPlaying ? 'pause' : 'play'}
                </button>
                <button onClick={onUpload} disabled={saving || !file || !user}> {saving ? 'uploading...' : 'upload'} </button>
                {!user && <div style={{ color: 'var(--white)' }}>login required</div>}
              </div>
              {error && <div style={{ color: 'var(--white)', marginTop: 8 }}>{error}</div>}
              {file && (
                <div style={{ marginTop: 8, color: 'var(--white)', opacity: 0.85 }}>selected: {file.name}</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {state && <Mixer state={state} />}
    </div>
  );
}

