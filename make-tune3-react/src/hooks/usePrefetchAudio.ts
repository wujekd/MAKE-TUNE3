import { useEffect, useRef } from 'react';

interface UsePrefetchAudioOptions {
  enabled?: boolean;
  preload?: 'auto' | 'metadata' | 'none';
}

export function usePrefetchAudio(src?: string, options: UsePrefetchAudioOptions = {}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { enabled = true, preload = 'auto' } = options;

  useEffect(() => {
    if (!enabled || !src) return;
    const audio = new Audio();
    audio.crossOrigin = 'anonymous';
    audio.preload = preload;
    audioRef.current = audio;
    const onCanPlay = () => {
      /* ready */
      console.log("onCanPlay loaded in track: " + src);
    };
    const onError = () => {
      /* ignore */
    };
    audio.addEventListener('canplay', onCanPlay);
    audio.addEventListener('error', onError);
    audio.src = src;
    audio.load();
    return () => {
      audio.removeEventListener('canplay', onCanPlay);
      audio.removeEventListener('error', onError);
      audioRef.current = null;
    };
  }, [enabled, preload, src]);
}
