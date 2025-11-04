import { useEffect } from 'react';
import type { Collaboration } from '../types/collaboration';

type Stage = 'submission' | 'voting' | 'completed';

type RedirectOptions = {
  expected: Stage;
  collaboration: Collaboration | null | undefined;
  collabId?: string | null;
  navigate: (path: string, options?: { replace?: boolean }) => void;
};

const stageToPath = (stage: Stage, id: string) => {
  switch (stage) {
    case 'submission':
      return `/collab/${id}/submit`;
    case 'voting':
      return `/collab/${id}`;
    case 'completed':
      return `/collab/${id}/completed`;
    default:
      return `/collab/${id}`;
  }
};

export function useStageRedirect({ expected, collaboration, collabId, navigate }: RedirectOptions) {
  useEffect(() => {
    if (!collaboration || !collabId) return;
    const status = String(collaboration.status || '').toLowerCase() as Stage;
    if (status === expected) return;

    if (status === 'submission' || status === 'voting' || status === 'completed') {
      console.log('[useStageRedirect] redirecting to stage', status, 'for', collabId);
      navigate(stageToPath(status, collabId), { replace: true });
    }
  }, [collaboration, collabId, expected, navigate]);
}
