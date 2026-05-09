import { useEffect, useMemo, useRef } from 'react';
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
  animationDelayMs?: number;
}

const displayedWaveformIds = new Set<string>();

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
  isPlaying,
  animationDelayMs = 0
}: BackingWaveformPreviewProps) {
  const seekBackingPreviewByRatio = usePlaybackStore(s => s.seekBackingPreviewByRatio);
  const playBackingTrack = usePlaybackStore(s => s.playBackingTrack);
  const initialMeta = useMemo(() => getBackingWaveformMeta(collaboration), [collaboration]);
  const waveformDisplayId = collaboration.id;
  const hasDisplayedBeforeRef = useRef(displayedWaveformIds.has(waveformDisplayId));

  const { data, uiState } = useWaveformData({
    initialMeta,
    initialData: collaboration.backingWaveformPreview ?? null,
    enabled: Boolean(collaboration.backingTrackPath),
    deferLoad: Boolean(collaboration.backingWaveformPreview) && !hasDisplayedBeforeRef.current,
    pollMeta: async () => {
      const nextCollab = await CollaborationService.getCollaboration(collaboration.id);
      if (!nextCollab) return null;
      return getBackingWaveformMeta(nextCollab);
    }
  });

  useEffect(() => {
    if (uiState === 'ready' && data) {
      displayedWaveformIds.add(waveformDisplayId);
    }
  }, [data, uiState, waveformDisplayId]);

  const visualState = uiState === 'ready'
    ? 'ready'
    : uiState === 'loading'
      ? 'loading'
      : 'placeholder';

  return (
    <WaveformStrip
      data={data}
      state={visualState}
      initialUnderlayData={hasDisplayedBeforeRef.current ? collaboration.backingWaveformPreview ?? null : null}
      animationDelayMs={animationDelayMs}
      initialCascadeProgress={hasDisplayedBeforeRef.current ? 1 : 0}
      repeatCascadeProgress={0}
      progress={progress}
      currentTime={currentTime}
      duration={duration}
      isPlaying={isPlaying}
      isInteractive={uiState === 'ready'}
      onSeek={ratio => {
        if (isActive) {
          seekBackingPreviewByRatio(ratio);
          return;
        }
        if (collaboration.backingTrackPath) {
          playBackingTrack(collaboration.backingTrackPath, collaboration.name || 'backing', ratio);
        }
      }}
    />
  );
}
