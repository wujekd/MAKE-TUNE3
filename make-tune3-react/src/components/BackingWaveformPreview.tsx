import { useMemo } from 'react';
import type { Collaboration } from '../types/collaboration';
import type { WaveformAssetMeta } from '../types/waveform';
import { CollaborationService } from '../services';
import { useWaveformData } from '../hooks/useWaveformData';
import { usePlaybackStore } from '../stores/usePlaybackStore';
import { WaveformStrip } from './WaveformStrip';

interface BackingWaveformPreviewProps {
  collaboration: Collaboration;
  isActive: boolean;
  progress: number;
  currentTime: number;
  duration: number;
  isPlaying: boolean;
}

function getBackingWaveformMeta(collaboration: Collaboration): WaveformAssetMeta {
  const data = collaboration as Collaboration & {
    backingWaveformPath?: string | null;
    backingWaveformStatus?: WaveformAssetMeta['status'];
    backingWaveformBucketCount?: number | null;
    backingWaveformVersion?: number | null;
    backingWaveformError?: string | null;
  };

  return {
    path: data.backingWaveformPath ?? null,
    status: data.backingWaveformStatus ?? (data.backingTrackPath ? 'pending' : null),
    bucketCount: data.backingWaveformBucketCount ?? null,
    version: data.backingWaveformVersion ?? null,
    error: data.backingWaveformError ?? null
  };
}

export function BackingWaveformPreview({
  collaboration,
  isActive,
  progress,
  currentTime,
  duration,
  isPlaying
}: BackingWaveformPreviewProps) {
  const seekBackingPreviewByRatio = usePlaybackStore(s => s.seekBackingPreviewByRatio);
  const initialMeta = useMemo(() => getBackingWaveformMeta(collaboration), [collaboration]);

  const { data, uiState } = useWaveformData({
    initialMeta,
    enabled: Boolean(collaboration.backingTrackPath),
    pollMeta: async () => {
      const nextCollab = await CollaborationService.getCollaboration(collaboration.id);
      if (!nextCollab) return null;
      return getBackingWaveformMeta(nextCollab);
    }
  });

  const visualState = uiState === 'ready'
    ? 'ready'
    : uiState === 'loading'
      ? 'loading'
      : 'placeholder';

  return (
    <WaveformStrip
      data={data}
      state={visualState}
      progress={progress}
      currentTime={currentTime}
      duration={duration}
      isPlaying={isPlaying}
      isInteractive={isActive && isPlaying && uiState === 'ready'}
      onSeek={ratio => {
        if (!isActive || !isPlaying) return;
        seekBackingPreviewByRatio(ratio);
      }}
    />
  );
}
