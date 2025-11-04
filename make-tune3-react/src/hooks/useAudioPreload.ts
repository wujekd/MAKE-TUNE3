import { useContext, useEffect, useRef } from 'react';
import { AudioEngineContext } from '../audio-services/AudioEngineContext';

export function useAudioPreload(url?: string | null) {
  const audioCtx = useContext(AudioEngineContext);
  const pendingRef = useRef<string | null>(null);

  useEffect(() => {
    const engine = audioCtx?.engine;
    if (!engine || !url) return;
    pendingRef.current = url;
    engine.preloadBacking(url);
  }, [audioCtx?.engine, url]);

  useEffect(() => {
    const engine = audioCtx?.engine;
    if (!engine) return;

    const handler = async () => {
      await engine.unlock?.();
      const pending = pendingRef.current;
      if (pending) {
        engine.preloadBacking(pending);
      }
    };

    window.addEventListener('pointerdown', handler, { once: true });
    window.addEventListener('keydown', handler, { once: true });

    return () => {
      window.removeEventListener('pointerdown', handler as any);
      window.removeEventListener('keydown', handler as any);
    };
  }, [audioCtx?.engine]);
}
