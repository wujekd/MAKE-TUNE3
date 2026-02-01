import { useState, useRef, useEffect, useContext } from 'react';
import { AudioEngineContext } from '../audio-services/AudioEngineContext';
import { useAppStore } from '../stores/appStore';
import { usePlaybackStore } from '../stores/usePlaybackStore';
import { SubmissionService } from '../services';
import { ListPlayButton } from './ListPlayButton';

interface UploadSubmissionProps {
  collaborationId: string;
  backingUrl: string;
  onSubmitSuccess?: () => void;
}

export function UploadSubmission({ collaborationId, backingUrl, onSubmitSuccess }: UploadSubmissionProps) {
  const audioContext = useContext(AudioEngineContext);
  const { user } = useAppStore(s => s.auth);
  const { currentCollaboration } = useAppStore(s => s.collaboration);
  const playBackingTrack = usePlaybackStore(s => s.playBackingTrack);
  const backingPreview = usePlaybackStore(s => s.backingPreview);
  const togglePlayPause = useAppStore(s => s.playback.togglePlayPause);

  const [file, setFile] = useState<File | null>(null);
  const [multitrackZip, setMultitrackZip] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const blobUrlRef = useRef<string | null>(null);

  const backingCurrentTime = audioContext?.state?.player2?.currentTime || 0;
  const backingDuration = audioContext?.state?.player2?.duration || 0;
  const playbackProgress = backingDuration > 0 ? (backingCurrentTime / backingDuration) * 100 : 0;
  const backingPath = currentCollaboration?.backingTrackPath || '';
  const backingTarget = backingPath || backingUrl;
  const isCurrentBacking = backingPath
    ? backingPreview?.path === backingPath
    : audioContext?.state?.player2?.source === backingUrl;
  const isBackingPlaying = isCurrentBacking && !!audioContext?.state?.player2?.isPlaying;

  const handlePlayBacking = () => {
    if (!backingTarget) return;

    if (isCurrentBacking) {
      togglePlayPause();
    } else {
      playBackingTrack(backingTarget, currentCollaboration?.name || 'backing');
    }
  };

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
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        marginBottom: '12px',
        padding: '10px',
        background: 'var(--primary1-800)',
        borderRadius: '6px',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Playback progress overlay - shrinks from right as playback progresses */}
        {playbackProgress > 0 && (
          <div
            className="collab-progress-overlay"
            style={{
              width: `${100 - Math.min(playbackProgress, 100)}%`
            }}
          />
        )}

        <ListPlayButton
          label="Play backing"
          isPlaying={isBackingPlaying}
          isCurrentTrack={!!isCurrentBacking}
          onPlay={handlePlayBacking}
          disabled={!backingTarget}
          className={`list-play-button--wide ${!isBackingPlaying ? 'glow' : ''}`}
        />
        <div style={{ flex: 1, minWidth: 0, position: 'relative', zIndex: 1 }}>
          <h4 className="card__title" style={{ margin: 0 }}>Upload your submission</h4>
        </div>
      </div>
      <div className="card__body">
        <div className="submission-pane__description">Choose an audio file to submit to the current collaboration</div>
        <input type="file" accept="audio/*" onChange={(e) => setFile(e.target.files?.[0] || null)} />
        <div style={{ marginTop: 12 }}>
          <div className="submission-pane__description" style={{ marginBottom: 4, opacity: 0.8, fontSize: 12 }}>
            Multitrack ZIP (optional - stems for project owner)
          </div>
          <input
            type="file"
            accept=".zip,application/zip,application/x-zip-compressed"
            onChange={(e) => setMultitrackZip(e.target.files?.[0] || null)}
          />
          {multitrackZip && (
            <div style={{ color: 'var(--white)', fontSize: 12, opacity: 0.75, marginTop: 4 }}>
              {multitrackZip.name}
            </div>
          )}
        </div>
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
              await SubmissionService.uploadSubmission(file, collaborationId, user.uid, (p) => setProgress(p), currentSettings, multitrackZip);
              setFile(null);
              setMultitrackZip(null);
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
