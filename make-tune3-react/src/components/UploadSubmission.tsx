import { useState, useRef, useEffect, useContext } from 'react';
import { AudioEngineContext } from '../audio-services/AudioEngineContext';
import { useAppStore } from '../stores/appStore';
import { SubmissionService } from '../services';

interface UploadSubmissionProps {
  collaborationId: string;
  backingUrl: string;
  onSubmitSuccess?: () => void;
}

export function UploadSubmission({ collaborationId, backingUrl, onSubmitSuccess }: UploadSubmissionProps) {
  const audioContext = useContext(AudioEngineContext);
  const { user } = useAppStore(s => s.auth);
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const blobUrlRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, []);

  return (
    <div className="submission-pane">
      <h4 className="card__title">Upload your submission</h4>
      <div className="card__body">
        <div className="submission-pane__description">Choose an audio file to submit to the current collaboration</div>
        <input type="file" accept="audio/*" onChange={(e) => setFile(e.target.files?.[0] || null)} />
        <div className="submission-pane__actions">
          {file && audioContext && (
            <button className="submission-pane__button" onClick={async () => {
              const { engine, state } = audioContext;
              if (!engine) return;
              if (state?.player1?.isPlaying) {
                engine.stopPreview();
                return;
              }
              let url = blobUrlRef.current;
              if (!url) {
                url = URL.createObjectURL(file);
                blobUrlRef.current = url;
              }
              if (!backingUrl) return;
              await engine.previewSubmission(url, backingUrl);
            }}>
              {audioContext?.state?.player1?.isPlaying ? 'pause' : 'play'}
            </button>
          )}
          <button className="submission-pane__button" onClick={async () => {
            if (!user || !file) { setError('missing file or auth'); return; }
            setSaving(true); setError(null); setProgress(0);
            try {
              const currentSettings = audioContext?.state ? {
                eq: {
                  highshelf: { 
                    gain: audioContext.state.eq.highshelf.gain, 
                    frequency: audioContext.state.eq.highshelf.frequency 
                  },
                  param2: { 
                    gain: audioContext.state.eq.param2.gain, 
                    frequency: audioContext.state.eq.param2.frequency, 
                    Q: audioContext.state.eq.param2.Q 
                  },
                  param1: { 
                    gain: audioContext.state.eq.param1.gain, 
                    frequency: audioContext.state.eq.param1.frequency, 
                    Q: audioContext.state.eq.param1.Q 
                  },
                  highpass: { 
                    frequency: audioContext.state.eq.highpass.frequency, 
                    enabled: audioContext.state.eq.highpass.frequency > 20 
                  }
                },
                volume: { gain: audioContext.state.player1.volume }
              } : undefined;
              await SubmissionService.uploadSubmission(file, collaborationId, user.uid, (p) => setProgress(p), currentSettings);
              setFile(null);
              if (blobUrlRef.current) { URL.revokeObjectURL(blobUrlRef.current); blobUrlRef.current = null; }
              onSubmitSuccess?.();
            } catch (e: any) {
              setError(e?.message || 'upload failed');
            } finally {
              setSaving(false);
            }
          }} disabled={saving || !file || !user}>{saving ? `uploading ${progress}%` : 'upload'}</button>
          {saving && (
            <div className="submission-pane__progress">
              <div className="submission-pane__progress-bar" style={{ width: `${progress}%` }} />
            </div>
          )}
          {!user && <div style={{ color: 'var(--white)' }}>login required</div>}
        </div>
        {error && <div className="submission-pane__error">{error}</div>}
      </div>
    </div>
  );
}
