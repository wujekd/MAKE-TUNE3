import { useEffect, useState } from 'react';
import { useAppStore } from '../stores/appStore';

type LoaderState = 'idle' | 'loading' | 'not_found' | 'error';

export function useCollaborationLoader(collabId?: string | null) {
  const user = useAppStore(state => state.auth.user);
  const userId = user?.uid;
  const currentCollaborationId = useAppStore(state => state.collaboration.currentCollaboration?.id);
  const loadCollaboration = useAppStore(state => state.collaboration.loadCollaboration);
  const loadCollaborationAnonymousById = useAppStore(state => state.collaboration.loadCollaborationAnonymousById);

  const [status, setStatus] = useState<LoaderState>('idle');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!collabId) return;
    if (currentCollaborationId === collabId) {
      setStatus('idle');
      setError(null);
      return;
    }
    let cancelled = false;

    const run = async () => {
      setStatus('loading');
      setError(null);
      try {
        if (userId) {
          await loadCollaboration(userId, collabId);
        } else {
          await loadCollaborationAnonymousById(collabId);
        }
        if (!cancelled) {
          const loadedCollaboration = useAppStore.getState().collaboration.currentCollaboration;
          if (!loadedCollaboration || loadedCollaboration.id !== collabId) {
            setStatus('not_found');
            setError('collaboration not found');
            return;
          }
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
  }, [collabId, currentCollaborationId, userId, loadCollaboration, loadCollaborationAnonymousById]);

  return { status, error };
}
