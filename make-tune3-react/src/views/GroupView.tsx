import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { GroupService } from '../services';
import { useAppStore } from '../stores/appStore';
import type { Collaboration, Group, GroupMember, Project } from '../types/collaboration';
import { LoadingSpinner } from '../components/LoadingSpinner';
import styles from './DashboardView.module.css';

const collabRoute = (collab: Collaboration) => {
  if (collab.status === 'submission') return `/collab/${collab.id}/submit`;
  if (collab.status === 'completed') return `/collab/${collab.id}/completed`;
  return `/collab/${collab.id}`;
};

export function GroupView() {
  const { groupId } = useParams();
  const user = useAppStore(s => s.auth.user);
  const [group, setGroup] = useState<Group | null>(null);
  const [membership, setMembership] = useState<GroupMember | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [collabs, setCollabs] = useState<Collaboration[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);

  const load = async () => {
    if (!groupId) return;
    setLoading(true);
    setMessage(null);
    try {
      const details = await GroupService.getGroup(groupId);
      setGroup(details.group);
      setMembership(details.membership);
      setCanManage(details.canManage);
      if (details.group) {
        const [groupCollabs, groupProjects] = await Promise.all([
          GroupService.listGroupCollaborations(groupId),
          GroupService.listGroupProjects(groupId)
        ]);
        setCollabs(groupCollabs);
        setProjects(groupProjects);
        if (details.canManage) {
          setMembers(await GroupService.listGroupMembers(groupId));
        } else {
          setMembers([]);
        }
      }
    } catch (e: any) {
      setMessage(e?.message || 'failed to load group');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId, user?.uid]);

  const groupedCollabs = useMemo(() => ({
    active: collabs.filter(c => c.status === 'submission'),
    voting: collabs.filter(c => c.status === 'voting'),
    completed: collabs.filter(c => c.status === 'completed')
  }), [collabs]);

  const join = async () => {
    if (!groupId || !group) return;
    try {
      if (group.joinPolicy === 'open') {
        await GroupService.joinOpenGroup(groupId);
        setMessage('joined');
      } else if (group.joinPolicy === 'approval_required') {
        await GroupService.requestGroupAccess(groupId);
        setMessage('request sent');
      } else {
        setMessage('this group requires an invite link');
      }
      await load();
    } catch (e: any) {
      setMessage(e?.message || 'could not join');
    }
  };

  const createInvite = async () => {
    if (!groupId) return;
    try {
      const result = await GroupService.createGroupInvite(groupId);
      setInviteUrl(`${window.location.origin}/group/join/${result.inviteId}`);
    } catch (e: any) {
      setMessage(e?.message || 'could not create invite');
    }
  };

  const approve = async (userId: string) => {
    if (!groupId) return;
    try {
      await GroupService.approveGroupMember(groupId, userId);
      setMessage('member approved');
      setMembers(await GroupService.listGroupMembers(groupId));
    } catch (e: any) {
      setMessage(e?.message || 'could not approve member');
    }
  };

  const renderCollabs = (title: string, items: Collaboration[]) => (
    <>
      <h4 className="project-history-title">{title}</h4>
      {items.length === 0 ? (
        <div className={styles.emptyState}>none</div>
      ) : items.map(collab => (
        <Link key={collab.id} to={collabRoute(collab)} className="collab-history-item list__item">
          <div className="collab-list-item__main">
            <div className="collab-list-item__title">{collab.name}</div>
            <div style={{ color: 'var(--white)', opacity: 0.7, fontSize: 12 }}>
              submit: {collab.submitAccess || 'logged_in'} · vote: {collab.voteAccess || 'logged_in'}
            </div>
          </div>
        </Link>
      ))}
    </>
  );

  if (loading) {
    return <div className={`view-container ${styles.container}`}><LoadingSpinner size={28} /></div>;
  }

  if (!group) {
    return <div className={`view-container ${styles.container}`}>{message || 'group not found'}</div>;
  }

  return (
    <div className={`view-container ${styles.container}`}>
      <div className={styles.content} style={{ gridTemplateColumns: 'minmax(0, 1fr)' }}>
        <div className={`project-history ${styles.historyColumn}`} style={{ maxWidth: 900, margin: '0 auto', width: '100%' }}>
          <div className={styles.feedHeader}>
            <h4 className="project-history-title">{group.name}</h4>
            <p className={styles.feedIntro}>{group.description || `${group.visibility} group`}</p>
            {group.externalLinks?.map((link, index) => (
              <a key={`${link.url}-${index}`} href={link.url} target="_blank" rel="noreferrer">
                {link.label || link.type || link.url}
              </a>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
            {!membership && user && <button onClick={join}>{group.joinPolicy === 'approval_required' ? 'request access' : 'join group'}</button>}
            {membership?.status === 'requested' && <span>request pending</span>}
            {canManage && <button onClick={createInvite}>create invite link</button>}
          </div>
          {inviteUrl && <div style={{ color: 'var(--white)', fontSize: 12, marginBottom: 12 }}>{inviteUrl}</div>}
          {message && <div style={{ color: 'var(--dashboard-accent)', marginBottom: 12 }}>{message}</div>}

          <div className={`collab-list ${styles.collabList}`}>
            {canManage && (
              <>
                <h4 className="project-history-title">member requests</h4>
                {members.filter(member => member.status === 'requested').length === 0 ? (
                  <div className={styles.emptyState}>no pending requests</div>
                ) : members.filter(member => member.status === 'requested').map(member => (
                  <div key={member.userId} className="collab-history-item list__item">
                    <div className="collab-list-item__main">
                      <div className="collab-list-item__title">{member.userId}</div>
                      <div style={{ color: 'var(--white)', opacity: 0.7, fontSize: 12 }}>requested access</div>
                    </div>
                    <button onClick={() => approve(member.userId)}>approve</button>
                  </div>
                ))}
              </>
            )}
            {projects.length > 0 && (
              <>
                <h4 className="project-history-title">projects</h4>
                {projects.map(project => (
                  <Link key={project.id} to={`/project/${project.id}`} className="collab-history-item list__item">
                    <div className="collab-list-item__main">
                      <div className="collab-list-item__title">{project.name}</div>
                      <div style={{ color: 'var(--white)', opacity: 0.7, fontSize: 12 }}>{project.description}</div>
                    </div>
                  </Link>
                ))}
              </>
            )}
            {renderCollabs('active collaborations', groupedCollabs.active)}
            {renderCollabs('voting collaborations', groupedCollabs.voting)}
            {renderCollabs('completed collaborations', groupedCollabs.completed)}
          </div>
        </div>
      </div>
    </div>
  );
}
