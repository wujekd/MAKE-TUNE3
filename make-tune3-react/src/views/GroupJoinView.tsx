import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { GroupService } from '../services';
import { useAppStore } from '../stores/appStore';
import { LoadingSpinner } from '../components/LoadingSpinner';
import styles from './DashboardView.module.css';

export function GroupJoinView() {
  const { inviteId } = useParams();
  const user = useAppStore(s => s.auth.user);
  const authLoading = useAppStore(s => s.auth.loading);
  const [status, setStatus] = useState<'idle' | 'joining' | 'done' | 'error'>('idle');
  const [groupId, setGroupId] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (authLoading || !inviteId) return;
    if (!user) {
      setMessage('login required to join this group');
      return;
    }
    let mounted = true;
    setStatus('joining');
    GroupService.joinGroupWithInvite(inviteId)
      .then(result => {
        if (!mounted) return;
        setGroupId(result.groupId);
        setStatus('done');
      })
      .catch((e: any) => {
        if (!mounted) return;
        setMessage(e?.message || 'could not join group');
        setStatus('error');
      });
    return () => {
      mounted = false;
    };
  }, [authLoading, inviteId, user]);

  return (
    <div className={`view-container ${styles.container}`}>
      <div className={styles.emptyState} style={{ margin: '64px auto', maxWidth: 520 }}>
        {status === 'joining' && <LoadingSpinner size={28} />}
        {status === 'done' ? (
          <>
            <div className={styles.emptyStateTitle}>joined group</div>
            {groupId && <Link to={`/group/${groupId}`}>open group</Link>}
          </>
        ) : (
          <>
            <div className={styles.emptyStateTitle}>group invite</div>
            <div className={styles.emptyStateBody}>{message || 'joining...'}</div>
            {!user && !authLoading && <Link to="/auth?mode=login">login</Link>}
          </>
        )}
      </div>
    </div>
  );
}
