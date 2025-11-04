import { useEffect, useState } from 'react';
import type { Collaboration } from '../types/collaboration';
import { AudioUrlUtils } from '../utils';

export function useCollabBackingsPrefetch(collabs: Collaboration[], limit = 10) {
  const [urls, setUrls] = useState<string[]>([]);

  useEffect(() => {
    if (!collabs.length) {
      setUrls([]);
      return;
    }

    let cancelled = false;

    const run = async () => {
      const targets = collabs
        .filter(c => Boolean((c as any).backingTrackPath))
        .slice(0, limit);

      if (!targets.length) {
        setUrls([]);
        return;
      }

      const resolved: string[] = [];
      for (const collab of targets) {
        const backingPath = (collab as any).backingTrackPath as string | undefined;
        if (!backingPath) continue;
        try {
          const url = await AudioUrlUtils.resolveAudioUrl(backingPath);
          resolved.push(url);
        } catch (err) {
          console.warn('[useCollabBackingsPrefetch] failed to resolve', backingPath, err);
        }
        if (cancelled) {
          return;
        }
      }

      if (!cancelled) {
        setUrls(resolved);
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [collabs, limit]);

  return urls;
}
