import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './MissingCollaborationState.module.css';

type Props = {
  collaborationId?: string | null;
  viewLabel: string;
  redirectPath?: string;
  redirectDelaySeconds?: number;
};

export function MissingCollaborationState({
  collaborationId,
  viewLabel,
  redirectPath = '/collabs',
  redirectDelaySeconds = 5
}: Props) {
  const navigate = useNavigate();
  const [secondsRemaining, setSecondsRemaining] = useState(redirectDelaySeconds);

  useEffect(() => {
    const deadline = Date.now() + redirectDelaySeconds * 1000;
    const intervalId = window.setInterval(() => {
      const nextSeconds = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setSecondsRemaining(nextSeconds);
      if (nextSeconds === 0) {
        window.clearInterval(intervalId);
        navigate(redirectPath, { replace: true });
      }
    }, 250);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [navigate, redirectDelaySeconds, redirectPath]);

  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        <p className={styles.eyebrow}>Collaboration Missing</p>
        <h2 className={styles.title}>This collaboration no longer exists.</h2>
        <p className={styles.body}>
          The {viewLabel} could not be opened because the collaboration was removed or the link is no longer valid.
        </p>
        {collaborationId && (
          <p className={styles.meta}>
            Requested collaboration: <span className={styles.id}>{collaborationId}</span>
          </p>
        )}
        <p className={styles.meta}>
          Returning to the main page in {secondsRemaining} second{secondsRemaining === 1 ? '' : 's'}.
        </p>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.button}
            onClick={() => navigate(redirectPath, { replace: true })}
          >
            Go to main page
          </button>
        </div>
      </div>
    </div>
  );
}
