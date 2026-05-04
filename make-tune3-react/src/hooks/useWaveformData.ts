import { useEffect, useMemo, useState } from 'react';
import { WaveformService } from '../services/waveformService';
import type { WaveformAssetMeta, WaveformData, WaveformStatus } from '../types/waveform';

type PollMetaFn = () => Promise<WaveformAssetMeta | null>;

interface UseWaveformDataOptions {
  initialMeta: WaveformAssetMeta;
  enabled?: boolean;
  pollMeta?: PollMetaFn;
  pollIntervalMs?: number;
  maxPollMs?: number;
}

type UiState = 'idle' | 'loading' | 'ready' | 'failed' | 'timed_out';

interface UseWaveformDataResult {
  data: WaveformData | null;
  meta: WaveformAssetMeta;
  uiState: UiState;
  isLoading: boolean;
  timedOut: boolean;
}

function normalizeMeta(meta: WaveformAssetMeta): WaveformAssetMeta {
  return {
    path: meta.path ?? null,
    status: meta.status ?? null,
    bucketCount: meta.bucketCount ?? null,
    version: meta.version ?? null,
    error: meta.error ?? null
  };
}

function isPendingStatus(status?: WaveformStatus | null): boolean {
  return status === 'pending' || status === 'processing';
}

export function useWaveformData({
  initialMeta,
  enabled = true,
  pollMeta,
  pollIntervalMs = 5000,
  maxPollMs = 60000
}: UseWaveformDataOptions): UseWaveformDataResult {
  const normalizedInitialMeta = useMemo(() => normalizeMeta(initialMeta), [initialMeta]);
  const [meta, setMeta] = useState<WaveformAssetMeta>(normalizedInitialMeta);
  const [data, setData] = useState<WaveformData | null>(null);
  const [uiState, setUiState] = useState<UiState>(() => {
    if (!enabled) return 'idle';
    if (normalizedInitialMeta.status === 'ready' && normalizedInitialMeta.path) return 'loading';
    if (normalizedInitialMeta.status === 'failed') return 'failed';
    if (isPendingStatus(normalizedInitialMeta.status)) return 'loading';
    return 'idle';
  });

  useEffect(() => {
    setMeta(normalizedInitialMeta);
    setData(null);

    if (!enabled) {
      setUiState('idle');
      return;
    }

    if (normalizedInitialMeta.status === 'ready' && normalizedInitialMeta.path) {
      setUiState('loading');
      return;
    }

    if (normalizedInitialMeta.status === 'failed') {
      setUiState('failed');
      return;
    }

    if (isPendingStatus(normalizedInitialMeta.status)) {
      setUiState('loading');
      return;
    }

    setUiState('idle');
  }, [enabled, normalizedInitialMeta]);

  useEffect(() => {
    if (!enabled || meta.status !== 'ready' || !meta.path) {
      return;
    }

    let cancelled = false;
    setUiState('loading');

    WaveformService.loadWaveform(meta.path)
      .then(nextData => {
        if (cancelled) return;
        setData(nextData);
        setUiState('ready');
      })
      .catch(() => {
        if (cancelled) return;
        setUiState('failed');
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, meta.path, meta.status]);

  useEffect(() => {
    if (!enabled || !pollMeta || !isPendingStatus(meta.status)) {
      return;
    }

    let cancelled = false;
    const startedAt = Date.now();
    let timer: number | null = null;

    const runPoll = async () => {
      if (cancelled) return;
      if (Date.now() - startedAt >= maxPollMs) {
        setUiState(current => (current === 'ready' ? current : 'timed_out'));
        return;
      }

      try {
        const nextMeta = await pollMeta();
        if (cancelled || !nextMeta) return;
        const normalizedNextMeta = normalizeMeta(nextMeta);
        setMeta(normalizedNextMeta);

        if (normalizedNextMeta.status === 'failed') {
          setUiState('failed');
          return;
        }

        if (normalizedNextMeta.status === 'ready' && normalizedNextMeta.path) {
          setUiState('loading');
          return;
        }
      } catch {
        // Keep polling until timeout.
      }

      if (!cancelled) {
        timer = window.setTimeout(runPoll, pollIntervalMs);
      }
    };

    timer = window.setTimeout(runPoll, pollIntervalMs);

    return () => {
      cancelled = true;
      if (timer !== null) {
        window.clearTimeout(timer);
      }
    };
  }, [enabled, maxPollMs, meta.status, pollIntervalMs, pollMeta]);

  return {
    data,
    meta,
    uiState,
    isLoading: uiState === 'loading',
    timedOut: uiState === 'timed_out'
  };
}
