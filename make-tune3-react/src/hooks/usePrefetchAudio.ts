import { useEffect, useRef } from 'react';

export function usePrefetchAudio(src?: string) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!src) return;
    const audio = new Audio();
    audio.crossOrigin = 'anonymous';
    audio.preload = 'auto';
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
  }, [src]);
}
