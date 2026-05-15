import type { ReactNode } from 'react';
import { WaveformStrip } from './WaveformStrip';
import type { WaveformRenderData } from '../types/waveform';
import './UploadSubmission.css';

type WaveformUiState = 'loading' | 'ready' | 'placeholder';

interface PlaybackState {
  progress?: number;
  currentTime?: number;
  duration?: number;
  isPlaying?: boolean;
}

interface SubmissionWaveformFrameProps {
  backingWaveformData?: WaveformRenderData | null;
  backingWaveformState?: WaveformUiState;
  uploadWaveformData?: WaveformRenderData | null;
  uploadWaveformState?: WaveformUiState;
  backingPlayback?: PlaybackState;
  uploadPlayback?: PlaybackState;
  children: ReactNode;
}

export function SubmissionWaveformFrame({
  backingWaveformData = null,
  backingWaveformState = 'placeholder',
  uploadWaveformData = null,
  uploadWaveformState = 'placeholder',
  backingPlayback,
  uploadPlayback,
  children
}: SubmissionWaveformFrameProps) {
  return (
    <div className="submission-upload">
      <div className="submission-upload__waveform-backdrop submission-upload__waveform-backdrop--top" aria-hidden="true">
        <WaveformStrip
          data={backingWaveformData}
          state={backingWaveformState}
          progress={backingPlayback?.progress ?? 0}
          currentTime={backingPlayback?.currentTime ?? 0}
          duration={backingPlayback?.duration ?? 0}
          isPlaying={Boolean(backingPlayback?.isPlaying)}
          underlayAlpha={0.68}
          waveformAlpha={1.2}
        />
      </div>
      <div className="submission-upload__waveform-backdrop submission-upload__waveform-backdrop--bottom" aria-hidden="true">
        <WaveformStrip
          data={uploadWaveformData}
          state={uploadWaveformState}
          initialCascadeProgress={1}
          repeatCascadeProgress={0}
          progress={uploadPlayback?.progress ?? 0}
          currentTime={uploadPlayback?.currentTime ?? 0}
          duration={uploadPlayback?.duration ?? 0}
          isPlaying={Boolean(uploadPlayback?.isPlaying)}
          underlayAlpha={0.68}
          waveformAlpha={1.2}
        />
      </div>

      <div className="submission-upload__chrome">
        {children}
      </div>
    </div>
  );
}
