import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { GroupService } from '../services';
import { useAppStore } from '../stores/appStore';
import type { Group, GroupJoinPolicy, GroupVisibility } from '../types/collaboration';
import { LoadingSpinner } from '../components/LoadingSpinner';
import styles from './DashboardView.module.css';

export function GroupsView() {
  const user = useAppStore(s => s.auth.user);
  const navigate = useNavigate();
  const [publicGroups, setPublicGroups] = useState<Group[]>([]);
  const [myGroups, setMyGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<GroupVisibility>('public');
  const [joinPolicy, setJoinPolicy] = useState<GroupJoinPolicy>('open');
  const [externalUrl, setExternalUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [pub, mine] = await Promise.all([
        GroupService.listPublicGroups(),
        user ? GroupService.listMyGroups() : Promise.resolve([])
      ]);
      setPublicGroups(pub);
      setMyGroups(mine);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  const create = async () => {
    if (!user) {
      setError('login required');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const group = await GroupService.createGroup({
        name,
        description,
        visibility,
        joinPolicy,
        externalLinks: externalUrl ? [{ type: 'website', url: externalUrl }] : []
      });
      navigate(`/group/${group.id}`);
    } catch (e: any) {
      setError(e?.message || 'failed to create group');
    } finally {
      setSaving(false);
    }
  };

  const renderGroup = (group: Group) => (
    <Link key={group.id} to={`/group/${group.id}`} className="collab-history-item list__item">
      <div className="collab-list-item__main">
        <div className="collab-list-item__title">{group.name}</div>
        <div style={{ color: 'var(--white)', opacity: 0.7, fontSize: 12 }}>
          {group.description || `${group.visibility} group`}
        </div>
      </div>
    </Link>
  );

  return (
    <div className={`view-container ${styles.container}`}>
      <div className={styles.content} style={{ gridTemplateColumns: 'minmax(0, 1fr)' }}>
        <div className={`project-history ${styles.historyColumn}`} style={{ maxWidth: 900, margin: '0 auto', width: '100%' }}>
          <div className={styles.feedHeader}>
            <h4 className="project-history-title">groups</h4>
            <p className={styles.feedIntro}>lightweight music rooms for existing communities</p>
          </div>

          {user && (
            <button className={styles.feedOption} onClick={() => setShowCreate(v => !v)}>
              create group
            </button>
          )}

          {showCreate && (
            <div className="collab-history-item list__item" style={{ display: 'grid', gap: 8, marginTop: 12 }}>
              <input placeholder="group name" value={name} onChange={e => setName(e.target.value)} />
              <textarea placeholder="description" value={description} onChange={e => setDescription(e.target.value)} rows={3} />
              <input placeholder="external community link" value={externalUrl} onChange={e => setExternalUrl(e.target.value)} />
              <select value={visibility} onChange={e => setVisibility(e.target.value as GroupVisibility)}>
                <option value="public">public</option>
                <option value="unlisted">unlisted</option>
                <option value="private">private</option>
              </select>
              <select value={joinPolicy} onChange={e => setJoinPolicy(e.target.value as GroupJoinPolicy)}>
                <option value="open">open</option>
                <option value="invite_link">invite link</option>
                <option value="approval_required">approval required</option>
              </select>
              {error && <div style={{ color: 'var(--dashboard-accent)' }}>{error}</div>}
              <button disabled={saving} onClick={create}>{saving ? 'creating...' : 'create'}</button>
            </div>
          )}

          {loading ? (
            <div style={{ padding: 24 }}><LoadingSpinner size={24} /></div>
          ) : (
            <div className={`collab-list ${styles.collabList}`} style={{ marginTop: 16 }}>
              {myGroups.length > 0 && <h4 className="project-history-title">my groups</h4>}
              {myGroups.map(renderGroup)}
              <h4 className="project-history-title">public groups</h4>
              {publicGroups.length === 0 ? (
                <div className={styles.emptyState}>no public groups yet</div>
              ) : publicGroups.map(renderGroup)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
