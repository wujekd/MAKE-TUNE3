import { useState, useRef, useEffect, useContext } from 'react';
import type { ChangeEvent } from 'react';
import { AudioEngineContext } from '../audio-services/AudioEngineContext';
import { useAppStore } from '../stores/appStore';
import { usePlaybackStore } from '../stores/usePlaybackStore';
import { SubmissionService } from '../services/submissionService';
import { ListPlayButton } from './ListPlayButton';
import { SubmissionWaveformFrame } from './SubmissionWaveformFrame';
import type { WaveformRenderData } from '../types/waveform';
import './UploadSubmission.css';

interface UploadSubmissionProps {
  collaborationId: string;
  backingUrl: string;
  backingWaveformData?: WaveformRenderData | null;
  backingWaveformState?: 'loading' | 'ready' | 'placeholder';
  onSubmitSuccess?: () => void;
}

type AnalysisTone = 'good' | 'watch' | 'problem';

interface AudioFileAnalysis {
  duration: number;
  sampleRate: number;
  channels: number;
  peakDb: number;
  rmsDb: number;
  crestDb: number;
  clippingPercent: number;
  waveformData: WaveformRenderData;
  verdict: AnalysisTone;
  summary: string;
}

const DB_FLOOR = -96;

function toDb(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return DB_FLOOR;
  return Math.max(DB_FLOOR, 20 * Math.log10(value));
}

function formatDb(value: number): string {
  return `${value.toFixed(1)} dB`;
}

function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60).toString().padStart(2, '0');
  return `${mins}:${secs}`;
}

function getVerdict(analysis: Pick<AudioFileAnalysis, 'duration' | 'peakDb' | 'rmsDb' | 'clippingPercent'>): Pick<AudioFileAnalysis, 'verdict' | 'summary'> {
  if (analysis.duration < 2) {
    return { verdict: 'problem', summary: 'This file is very short. Check that the full performance exported.' };
  }

  if (analysis.clippingPercent > 0.05 || analysis.peakDb > -0.1) {
    return { verdict: 'problem', summary: 'The file is hitting full scale. Lower the export level or limiter ceiling before upload.' };
  }

  if (analysis.peakDb > -1 || analysis.rmsDb > -10) {
    return { verdict: 'watch', summary: 'This is a hot export. It may be fine, but leave a little more headroom if you hear distortion.' };
  }

  if (analysis.peakDb < -18 || analysis.rmsDb < -34) {
    return { verdict: 'watch', summary: 'This looks quiet. Consider exporting a little louder before upload.' };
  }

  return { verdict: 'good', summary: 'Levels look healthy for upload.' };
}

async function analyzeAudioFile(file: File): Promise<AudioFileAnalysis> {
  const AudioContextCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextCtor) {
    throw new Error('Audio analysis is not supported in this browser.');
  }

  const arrayBuffer = await file.arrayBuffer();
  const decodeContext = new AudioContextCtor();

  try {
    const audioBuffer = await decodeContext.decodeAudioData(arrayBuffer.slice(0));
    const channels = Math.max(1, audioBuffer.numberOfChannels);
    const channelData = Array.from({ length: channels }, (_, index) => audioBuffer.getChannelData(index));
    const frames = audioBuffer.length;
    const bucketCount = Math.min(180, Math.max(48, Math.floor(frames / 1200) || 48));
    const minPeaks: number[] = [];
    const maxPeaks: number[] = [];
    let maxAbs = 0;
    let sumSquares = 0;
    let totalSamples = 0;
    let clippingSamples = 0;

    for (let bucketIndex = 0; bucketIndex < bucketCount; bucketIndex += 1) {
      const start = Math.floor((bucketIndex / bucketCount) * frames);
      const end = Math.max(start + 1, Math.floor(((bucketIndex + 1) / bucketCount) * frames));
      let bucketMin = 1;
      let bucketMax = -1;

      for (let frame = start; frame < end; frame += 1) {
        let mixed = 0;
        for (let channel = 0; channel < channels; channel += 1) {
          const sample = channelData[channel][frame] || 0;
          const abs = Math.abs(sample);
          mixed += sample;
          maxAbs = Math.max(maxAbs, abs);
          sumSquares += sample * sample;
          totalSamples += 1;
          if (abs >= 0.995) clippingSamples += 1;
        }

        mixed /= channels;
        bucketMin = Math.min(bucketMin, mixed);
        bucketMax = Math.max(bucketMax, mixed);
      }

      minPeaks.push(bucketMin === 1 ? 0 : bucketMin);
      maxPeaks.push(bucketMax === -1 ? 0 : bucketMax);
    }

    const rms = Math.sqrt(sumSquares / Math.max(1, totalSamples));
    const peakDb = toDb(maxAbs);
    const rmsDb = toDb(rms);
    const clippingPercent = (clippingSamples / Math.max(1, totalSamples)) * 100;
    const verdict = getVerdict({
      duration: audioBuffer.duration,
      peakDb,
      rmsDb,
      clippingPercent
    });

    return {
      duration: audioBuffer.duration,
      sampleRate: audioBuffer.sampleRate,
      channels,
      peakDb,
      rmsDb,
      crestDb: peakDb - rmsDb,
      clippingPercent,
      waveformData: {
        version: 1,
        bucketCount,
        peaks: {
          min: minPeaks,
          max: maxPeaks
        }
      },
      ...verdict
    };
  } finally {
    decodeContext.close?.().catch(() => undefined);
  }
}

export function UploadSubmission({
  collaborationId,
  backingUrl,
  backingWaveformData = null,
  backingWaveformState = 'placeholder',
  onSubmitSuccess
}: UploadSubmissionProps) {
  const audioContext = useContext(AudioEngineContext);
  const user = useAppStore(s => s.auth.user);
  const currentCollaboration = useAppStore(s => s.collaboration.currentCollaboration);
  const playBackingTrack = usePlaybackStore(s => s.playBackingTrack);
  const backingPreview = usePlaybackStore(s => s.backingPreview);
  const togglePlayPause = useAppStore(s => s.playback.togglePlayPause);

  const [file, setFile] = useState<File | null>(null);
  const [multitrackZip, setMultitrackZip] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [analysisStatus, setAnalysisStatus] = useState<'idle' | 'analyzing' | 'ready' | 'failed'>('idle');
  const [analysis, setAnalysis] = useState<AudioFileAnalysis | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const blobUrlRef = useRef<string | null>(null);
  const analysisRunRef = useRef(0);

  const backingCurrentTime = audioContext?.state?.player2?.currentTime || 0;
  const backingDuration = audioContext?.state?.player2?.duration || 0;
  const playbackProgress = backingDuration > 0 ? (backingCurrentTime / backingDuration) * 100 : 0;
  const uploadCurrentTime = audioContext?.state?.player1?.currentTime || 0;
  const uploadDuration = audioContext?.state?.player1?.duration || 0;
  const uploadProgress = uploadDuration > 0 ? uploadCurrentTime / uploadDuration : 0;
  const isUploadPreviewPlaying = Boolean(file && audioContext?.state?.player1?.isPlaying);
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

  useEffect(() => {
    if (!file) {
      setAnalysisStatus('idle');
      setAnalysis(null);
      setAnalysisError(null);
      return;
    }

    const runId = analysisRunRef.current + 1;
    analysisRunRef.current = runId;
    setAnalysisStatus('analyzing');
    setAnalysis(null);
    setAnalysisError(null);

    analyzeAudioFile(file)
      .then(nextAnalysis => {
        if (analysisRunRef.current !== runId) return;
        setAnalysis(nextAnalysis);
        setAnalysisStatus('ready');
      })
      .catch(err => {
        if (analysisRunRef.current !== runId) return;
        setAnalysisError(err?.message || 'Could not analyze this audio file.');
        setAnalysisStatus('failed');
      });
  }, [file]);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.target.files?.[0] || null;
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
    setFile(nextFile);
  };

  const analysisTone = analysis?.verdict ?? 'watch';
  const uploadWaveformState = analysisStatus === 'analyzing'
    ? 'loading'
    : analysis?.waveformData
      ? 'ready'
      : 'placeholder';
  const analysisStats = [
    { label: 'File', value: file?.name || 'No file selected', kind: 'file' },
    { label: 'Peak', value: analysis ? formatDb(analysis.peakDb) : '--' },
    { label: 'Average', value: analysis ? formatDb(analysis.rmsDb) : '--' },
    { label: 'Range', value: analysis ? formatDb(analysis.crestDb) : '--' },
    { label: 'Clip', value: analysis ? `${analysis.clippingPercent.toFixed(2)}%` : '--' },
    { label: 'Length', value: analysis ? formatDuration(analysis.duration) : '--' }
  ];

  return (
    <SubmissionWaveformFrame
      backingWaveformData={backingWaveformData}
      backingWaveformState={backingWaveformState}
      uploadWaveformData={analysis?.waveformData ?? null}
      uploadWaveformState={uploadWaveformState}
      backingPlayback={{
        progress: playbackProgress / 100,
        currentTime: backingCurrentTime,
        duration: backingDuration,
        isPlaying: isBackingPlaying
      }}
      uploadPlayback={{
        progress: uploadProgress,
        currentTime: uploadCurrentTime,
        duration: uploadDuration,
        isPlaying: isUploadPreviewPlaying
      }}
    >
      <section className="submission-upload__zone submission-upload__zone--collab">
          <div className="submission-upload__panel-head">
            <div>
              <div className="submission-upload__eyebrow">Backing</div>
              <h4 className="submission-upload__title">{currentCollaboration?.name || 'Collaboration backing'}</h4>
            </div>
            <ListPlayButton
              label="Play backing"
              isPlaying={isBackingPlaying}
              isCurrentTrack={!!isCurrentBacking}
              onPlay={handlePlayBacking}
              disabled={!backingTarget}
              className={`list-play-button--wide ${!isBackingPlaying ? 'glow' : ''}`}
            />
          </div>
          {playbackProgress > 0 && (
            <span
              className="submission-upload__progress"
              style={{ transform: `scaleX(${Math.min(playbackProgress, 100) / 100})` }}
              aria-hidden="true"
            />
          )}
      </section>

      <section className="submission-upload__zone submission-upload__zone--user">
          <div className="submission-upload__panel-head">
            <div>
              <div className="submission-upload__eyebrow">Your upload</div>
            </div>
          </div>

          <div className={`submission-upload__analysis submission-upload__analysis--${analysisTone}`}>
            {analysisStatus === 'idle' && (
              <div className="submission-upload__analysis-summary">Select your mix to preview its waveform and check upload levels.</div>
            )}
            {analysisStatus === 'analyzing' && (
              <div className="submission-upload__analysis-summary">Analyzing waveform and average levels...</div>
            )}
            {analysisStatus === 'failed' && (
              <div className="submission-upload__analysis-summary">{analysisError || 'Could not analyze this audio file.'}</div>
            )}
            {analysisStatus === 'ready' && analysis && (
              <div className="submission-upload__analysis-summary">{analysis.summary}</div>
            )}
            <div className="submission-upload__metrics">
              {analysisStats.map(stat => (
                <div
                  className={`submission-upload__metric ${stat.kind === 'file' ? 'submission-upload__metric--file' : ''}`}
                  key={stat.label}
                >
                  <span>{stat.label}</span>
                  <strong>{stat.value}</strong>
                </div>
              ))}
            </div>
            <div className="submission-upload__detail">
              {analysis
                ? `${analysis.channels} channel${analysis.channels === 1 ? '' : 's'} / ${Math.round(analysis.sampleRate / 100) / 10} kHz`
                : 'Channels / sample rate will appear after selection'}
            </div>
          </div>

          <div className="submission-upload__resource-row">
            <label className="submission-upload__file-button submission-upload__file-button--primary">
              Select audio
              <input type="file" accept="audio/*" onChange={handleFileChange} />
            </label>
            <label className="submission-upload__file-button submission-upload__file-button--secondary">
              Select ZIP
              <input
                type="file"
                accept=".zip,application/zip,application/x-zip-compressed"
                onChange={(e) => setMultitrackZip(e.target.files?.[0] || null)}
              />
            </label>
            <div className="submission-pane__description">
              Optional stems for project owner
            </div>
            {multitrackZip && (
              <div className="submission-upload__selected-file">
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
            {!user && <div className="submission-upload__login-required">login required</div>}
          </div>
          {error && <div className="submission-pane__error">{error}</div>}
      </section>
    </SubmissionWaveformFrame>
  );
}
