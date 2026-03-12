import { useEffect, useState } from 'react';
import { resolveStorageDownloadUrl } from '../services/storageService';

export function normalizeAudioPath(path?: string | null): string | null {
  if (!path) return null;
  return path;
}

export function useResolvedAudioUrl(path?: string | null) {
  const [url, setUrl] = useState<string>('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const normalized = normalizeAudioPath(path);
    if (!normalized) {
      setUrl('');
      return;
    }

    if (!normalized.startsWith('collabs/')) {
      setUrl(normalized);
      return;
    }

    let cancelled = false;
    setLoading(true);

    resolveStorageDownloadUrl(normalized)
      .then(resolved => {
        if (!cancelled) {
          setUrl(resolved);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setUrl('');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [path]);

  return { url, loading };
}
