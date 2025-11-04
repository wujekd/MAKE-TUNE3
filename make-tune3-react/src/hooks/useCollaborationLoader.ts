import { useEffect, useState } from 'react';
import { useAppStore } from '../stores/appStore';

type LoaderState = 'idle' | 'loading' | 'error';

export function useCollaborationLoader(collabId?: string | null) {
  const user = useAppStore(state => state.auth.user);
  const loadCollaboration = useAppStore(state => state.collaboration.loadCollaboration);
  const loadCollaborationAnonymousById = useAppStore(state => state.collaboration.loadCollaborationAnonymousById);

  const [status, setStatus] = useState<LoaderState>('idle');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!collabId) return;
    let cancelled = false;

    const run = async () => {
      setStatus('loading');
      setError(null);
      try {
        if (user) {
          await loadCollaboration(user.uid, collabId);
        } else {
          await loadCollaborationAnonymousById(collabId);
        }
        if (!cancelled) {
          setStatus('idle');
        }
      } catch (err: any) {
        if (!cancelled) {
          setStatus('error');
          setError(err?.message ?? 'failed to load collaboration');
        }
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [collabId, user?.uid, loadCollaboration, loadCollaborationAnonymousById]);

  return { status, error };
}
