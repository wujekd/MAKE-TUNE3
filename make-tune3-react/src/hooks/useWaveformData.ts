import { useEffect, useMemo, useRef, useState } from 'react';
import { WaveformService } from '../services/waveformService';
import type { WaveformAssetMeta, WaveformRenderData, WaveformStatus } from '../types/waveform';

type PollMetaFn = () => Promise<WaveformAssetMeta | null>;

interface UseWaveformDataOptions {
  initialMeta: WaveformAssetMeta;
  initialData?: WaveformRenderData | null;
  enabled?: boolean;
  deferLoad?: boolean;
  pollMeta?: PollMetaFn;
  pollIntervalMs?: number;
  maxPollMs?: number;
}

type UiState = 'idle' | 'loading' | 'ready' | 'failed' | 'timed_out';

interface UseWaveformDataResult {
  data: WaveformRenderData | null;
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

function scheduleSettledLoad(callback: () => void): () => void {
  let cancelled = false;
  let timer: number | null = null;
  let idleHandle: number | null = null;

  const requestIdle = () => {
    if (cancelled) return;
    const win = window as Window & {
      requestIdleCallback?: (handler: () => void, options?: { timeout: number }) => number;
      cancelIdleCallback?: (handle: number) => void;
    };

    if (typeof win.requestIdleCallback === 'function') {
      idleHandle = win.requestIdleCallback(() => {
        if (!cancelled) callback();
      }, { timeout: 3000 });
      return;
    }

    timer = window.setTimeout(() => {
      if (!cancelled) callback();
    }, 800);
  };

  const afterLoad = () => {
    timer = window.setTimeout(requestIdle, 800);
  };

  if (document.readyState === 'complete') {
    afterLoad();
  } else {
    window.addEventListener('load', afterLoad, { once: true });
  }

  return () => {
    cancelled = true;
    window.removeEventListener('load', afterLoad);
    if (timer !== null) window.clearTimeout(timer);
    if (idleHandle !== null) {
      const win = window as Window & { cancelIdleCallback?: (handle: number) => void };
      win.cancelIdleCallback?.(idleHandle);
    }
  };
}

export function useWaveformData({
  initialMeta,
  initialData = null,
  enabled = true,
  deferLoad = false,
  pollMeta,
  pollIntervalMs = 5000,
  maxPollMs = 60000
}: UseWaveformDataOptions): UseWaveformDataResult {
  const normalizedInitialMeta = useMemo(() => normalizeMeta(initialMeta), [initialMeta]);
  const [meta, setMeta] = useState<WaveformAssetMeta>(normalizedInitialMeta);
  const [data, setData] = useState<WaveformRenderData | null>(initialData);
  const dataIdentityRef = useRef<string | null>(normalizedInitialMeta.path ?? null);
  const hasRenderableData = Boolean(data);
  const [uiState, setUiState] = useState<UiState>(() => {
    if (!enabled) return 'idle';
    if (initialData) return 'ready';
    if (normalizedInitialMeta.status === 'ready' && normalizedInitialMeta.path) return 'loading';
    if (normalizedInitialMeta.status === 'failed') return 'failed';
    if (isPendingStatus(normalizedInitialMeta.status)) return 'loading';
    return 'idle';
  });

  useEffect(() => {
    const previousIdentity = dataIdentityRef.current;
    const nextIdentity = normalizedInitialMeta.path ?? null;
    const sameWaveform = previousIdentity === nextIdentity;

    setMeta(normalizedInitialMeta);
    setData(currentData => {
      if (sameWaveform && currentData) {
        return currentData;
      }
      dataIdentityRef.current = nextIdentity;
      return initialData;
    });

    if (!enabled) {
      setUiState('idle');
      return;
    }

    if ((sameWaveform && data) || initialData) {
      setUiState('ready');
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
  }, [enabled, initialData, normalizedInitialMeta]);

  useEffect(() => {
    if (!enabled || meta.status !== 'ready' || !meta.path) {
      return;
    }

    let cancelled = false;
    const waveformPath = meta.path;
    const load = () => {
      if (cancelled) return;
      setUiState(current => (hasRenderableData ? 'ready' : current === 'ready' ? current : 'loading'));

      WaveformService.loadWaveform(waveformPath)
        .then(nextData => {
          if (cancelled) return;
          dataIdentityRef.current = waveformPath;
          setData(nextData);
          setUiState('ready');
        })
        .catch(() => {
          if (cancelled) return;
          setUiState(hasRenderableData ? 'ready' : 'failed');
        });
    };

    const cleanupDeferredLoad = deferLoad ? scheduleSettledLoad(load) : null;
    if (!deferLoad) load();

    return () => {
      cancelled = true;
      cleanupDeferredLoad?.();
    };
  }, [deferLoad, enabled, hasRenderableData, meta.path, meta.status]);

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
