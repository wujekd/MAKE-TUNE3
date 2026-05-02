import { Suspense, lazy, useEffect, useState } from 'react';
import type { ReactNode } from 'react';

const AudioEngineProvider = lazy(() =>
  import('../audio-services/AudioEngineProvider').then(module => ({ default: module.AudioEngineProvider }))
);

interface AudioRouteBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  defer?: boolean;
  deferMs?: number;
}

export function AudioRouteBoundary({
  children,
  fallback,
  defer = false,
  deferMs = 1200
}: AudioRouteBoundaryProps) {
  const [shouldMount, setShouldMount] = useState(!defer);

  useEffect(() => {
    if (!defer) return;

    let cancelled = false;
    const activate = () => {
      if (!cancelled) {
        setShouldMount(true);
      }
    };

    const timerId = window.setTimeout(activate, deferMs);
    const onPointerDown = () => activate();
    const onKeyDown = () => activate();

    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);

    return () => {
      cancelled = true;
      window.clearTimeout(timerId);
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [defer, deferMs]);

  if (!shouldMount) {
    return <>{children}</>;
  }

  return (
    <Suspense fallback={fallback ?? children}>
      <AudioEngineProvider>{children}</AudioEngineProvider>
    </Suspense>
  );
}
