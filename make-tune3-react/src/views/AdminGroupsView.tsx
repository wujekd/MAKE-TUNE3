import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AdminLayout } from '../components/AdminLayout';
import { AdminService } from '../services';
import type {
  AdminGroupCollaborationItem,
  AdminGroupDetailsResult,
  AdminGroupItem,
  AdminGroupMemberItem,
  AdminGroupProjectItem
} from '../services';

type VisibilityFilter = '' | AdminGroupItem['visibility'];

const panelStyle = {
  background: 'var(--primary1-700)',
  borderRadius: 12,
  padding: 16,
  color: 'var(--white)'
} as const;

const inputStyle = {
  padding: 10,
  background: 'var(--primary1-800)',
  border: '1px solid var(--primary1-500)',
  borderRadius: 4,
  color: 'var(--white)',
  fontSize: 14
} as const;

function formatDate(value: number | null) {
  return value ? new Date(value).toLocaleString() : 'unknown';
}

function joinPolicyLabel(value: string) {
  return value.replace('_', ' ');
}

export function AdminGroupsView() {
  const navigate = useNavigate();
  const [groups, setGroups] = useState<AdminGroupItem[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [details, setDetails] = useState<AdminGroupDetailsResult | null>(null);
  const [visibility, setVisibility] = useState<VisibilityFilter>('');
  const [loading, setLoading] = useState(true);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionTarget, setActionTarget] = useState<string | null>(null);
  const [pageTokens, setPageTokens] = useState<(string | null)[]>([null]);
  const [currentPage, setCurrentPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editVisibility, setEditVisibility] = useState<AdminGroupItem['visibility']>('public');
  const [editJoinPolicy, setEditJoinPolicy] = useState<AdminGroupItem['joinPolicy']>('open');
  const [editLinkLabel, setEditLinkLabel] = useState('');
  const [editLinkUrl, setEditLinkUrl] = useState('');

  useEffect(() => {
    void loadGroups(0, [null], visibility);
  }, []);

  useEffect(() => {
    if (!details?.group) return;
    const group = details.group;
    const firstLink = group.externalLinks?.[0];
    setEditName(group.name);
    setEditDescription(group.description || '');
    setEditVisibility(group.visibility);
    setEditJoinPolicy(group.joinPolicy);
    setEditLinkLabel(firstLink?.label || firstLink?.type || '');
    setEditLinkUrl(firstLink?.url || '');
  }, [details?.group?.id]);

  const loadGroups = async (page: number, tokens: (string | null)[], nextVisibility = visibility) => {
    setLoading(true);
    setError(null);
    try {
      const result = await AdminService.listGroups(25, tokens[page] ?? null, nextVisibility || null);
      setGroups(result.groups);
      setHasMore(result.hasMore);
      const newTokens = [...tokens];
      if (result.nextPageToken) {
        newTokens[page + 1] = result.nextPageToken;
      }
      setPageTokens(newTokens);
      setCurrentPage(page);
      if (!selectedGroupId && result.groups[0]) {
        setSelectedGroupId(result.groups[0].id);
        void loadGroupDetails(result.groups[0].id);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load groups');
    } finally {
      setLoading(false);
    }
  };

  const loadGroupDetails = async (groupId: string) => {
    setDetailsLoading(true);
    setActionError(null);
    setActionMessage(null);
    try {
      const result = await AdminService.getGroup(groupId);
      setDetails(result);
      setSelectedGroupId(groupId);
      setGroups(prev => prev.map(group => group.id === groupId ? result.group : group));
    } catch (err: any) {
      setDetails(null);
      setActionError(err?.message || 'Failed to load group');
    } finally {
      setDetailsLoading(false);
    }
  };

  const reloadCurrent = async () => {
    if (selectedGroupId) {
      await loadGroupDetails(selectedGroupId);
    }
    await loadGroups(currentPage, pageTokens);
  };

  const handleFilterChange = (value: VisibilityFilter) => {
    setVisibility(value);
    setCurrentPage(0);
    setPageTokens([null]);
    setSelectedGroupId(null);
    setDetails(null);
    void loadGroups(0, [null], value);
  };

  const goToPage = (page: number) => {
    if (page < 0) return;
    void loadGroups(page, pageTokens);
  };

  const handleSaveSettings = async () => {
    if (!details?.group) return;
    setActionTarget('settings');
    setActionError(null);
    setActionMessage(null);
    try {
      await AdminService.updateGroup(details.group.id, {
        name: editName,
        description: editDescription,
        visibility: editVisibility,
        joinPolicy: editJoinPolicy,
        externalLinks: editLinkUrl.trim()
          ? [{ type: 'external', label: editLinkLabel.trim() || 'Community home', url: editLinkUrl.trim() }]
          : []
      });
      setActionMessage('Group settings saved.');
      await reloadCurrent();
    } catch (err: any) {
      setActionError(err?.message || 'Failed to save group settings');
    } finally {
      setActionTarget(null);
    }
  };

  const handleUpdateMember = async (
    member: AdminGroupMemberItem,
    updates: { role?: AdminGroupMemberItem['role']; status?: AdminGroupMemberItem['status']; remove?: boolean }
  ) => {
    if (!details?.group) return;
    const target = `member:${member.userId}`;
    setActionTarget(target);
    setActionError(null);
    setActionMessage(null);
    try {
      await AdminService.updateGroupMember(details.group.id, member.userId, updates);
      setActionMessage(updates.remove ? 'Member removed.' : 'Member updated.');
      await reloadCurrent();
    } catch (err: any) {
      setActionError(err?.message || 'Failed to update member');
    } finally {
      setActionTarget(null);
    }
  };

  const handleRemoveAttachment = async (
    kind: 'project' | 'collaboration',
    item: AdminGroupProjectItem | AdminGroupCollaborationItem
  ) => {
    if (!details?.group) return;
    const confirmed = window.confirm(`Remove "${item.name || item.id}" from this group?`);
    if (!confirmed) return;
    const target = `${kind}:${item.id}`;
    setActionTarget(target);
    setActionError(null);
    setActionMessage(null);
    try {
      await AdminService.removeGroupAttachment(details.group.id, kind, item.id);
      setActionMessage(`${kind === 'project' ? 'Project' : 'Collaboration'} removed from group.`);
      await reloadCurrent();
    } catch (err: any) {
      setActionError(err?.message || `Failed to remove ${kind}`);
    } finally {
      setActionTarget(null);
    }
  };

  const handleDeleteGroup = async () => {
    if (!details?.group) return;
    const confirmed = window.confirm(
      `Delete group "${details.group.name}"? This removes memberships and detaches linked projects/collaborations.`
    );
    if (!confirmed) return;
    setActionTarget('delete');
    setActionError(null);
    setActionMessage(null);
    try {
      await AdminService.deleteGroup(details.group.id);
      setActionMessage('Group deleted.');
      setDetails(null);
      setSelectedGroupId(null);
      await loadGroups(0, [null]);
    } catch (err: any) {
      setActionError(err?.message || 'Failed to delete group');
    } finally {
      setActionTarget(null);
    }
  };

  const renderGroupList = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {groups.map(group => {
        const selected = group.id === selectedGroupId;
        return (
          <button
            key={group.id}
            onClick={() => loadGroupDetails(group.id)}
            style={{
              ...panelStyle,
              textAlign: 'left',
              cursor: 'pointer',
              border: selected ? '1px solid var(--contrast-600)' : '1px solid rgba(255,255,255,0.08)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <strong>{group.name}</strong>
              <span style={{ opacity: 0.75, fontSize: 12 }}>{group.visibility}</span>
            </div>
            <div style={{ opacity: 0.75, fontSize: 12, marginTop: 6 }}>
              {group.memberCount} members · {group.pendingCount} requests · {group.projectCount} projects · {group.collaborationCount} collabs
            </div>
          </button>
        );
      })}
      {!loading && groups.length === 0 && (
        <div style={{ color: 'var(--white)', opacity: 0.75 }}>No groups found.</div>
      )}
    </div>
  );

  return (
    <AdminLayout title="Group Management">
      <div style={{ display: 'grid', gridTemplateColumns: '320px minmax(0, 1fr)', gap: 16, minHeight: 0, flex: 1 }}>
        <aside style={{ display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0 }}>
          <div style={{ ...panelStyle, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, opacity: 0.85 }}>
              Visibility
              <select value={visibility} onChange={event => handleFilterChange(event.target.value as VisibilityFilter)} style={inputStyle}>
                <option value="">All groups</option>
                <option value="public">Public</option>
                <option value="unlisted">Unlisted</option>
                <option value="private">Private</option>
              </select>
            </label>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, opacity: 0.8 }}>
              <span>{loading ? 'Loading...' : `Page ${currentPage + 1}`}</span>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => goToPage(currentPage - 1)} disabled={currentPage === 0 || loading}>Prev</button>
                <button onClick={() => goToPage(currentPage + 1)} disabled={!hasMore || loading}>Next</button>
              </div>
            </div>
          </div>
          {error && <div style={{ color: '#ff6b6b', background: 'rgba(255,107,107,0.15)', padding: 12, borderRadius: 6 }}>{error}</div>}
          <div style={{ overflowY: 'auto', paddingRight: 4 }}>{renderGroupList()}</div>
        </aside>

        <section style={{ display: 'flex', flexDirection: 'column', gap: 16, minHeight: 0, overflowY: 'auto', paddingRight: 8 }}>
          {actionError && <div style={{ color: '#ff6b6b', background: 'rgba(255,107,107,0.15)', padding: 12, borderRadius: 6 }}>{actionError}</div>}
          {actionMessage && <div style={{ color: '#86efac', background: 'rgba(34,197,94,0.12)', padding: 12, borderRadius: 6 }}>{actionMessage}</div>}
          {detailsLoading && <div style={{ color: 'var(--white)', opacity: 0.75 }}>Loading group...</div>}
          {!detailsLoading && !details && (
            <div style={panelStyle}>Select a group to manage settings, members, and attachments.</div>
          )}
          {details && (
            <>
              <div style={{ ...panelStyle, display: 'flex', justifyContent: 'space-between', gap: 16 }}>
                <div>
                  <h3 style={{ margin: '0 0 8px' }}>{details.group.name}</h3>
                  <div style={{ opacity: 0.75, fontSize: 13 }}>
                    Owner: {details.group.ownerId || 'unknown'} · Created: {formatDate(details.group.createdAt)}
                  </div>
                  <div style={{ opacity: 0.75, fontSize: 13, marginTop: 4 }}>
                    {details.group.visibility} · {joinPolicyLabel(details.group.joinPolicy)}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <button onClick={() => navigate(`/group/${details.group.id}`)}>Open public view</button>
                  <button
                    onClick={handleDeleteGroup}
                    disabled={actionTarget === 'delete'}
                    style={{ background: '#ff5c5c', color: 'white' }}
                  >
                    {actionTarget === 'delete' ? 'Deleting...' : 'Delete group'}
                  </button>
                </div>
              </div>

              <div style={{ ...panelStyle, display: 'grid', gap: 12 }}>
                <h4 style={{ margin: 0 }}>Settings</h4>
                <input value={editName} onChange={event => setEditName(event.target.value)} style={inputStyle} />
                <textarea
                  value={editDescription}
                  onChange={event => setEditDescription(event.target.value)}
                  style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }}
                />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
                  <select value={editVisibility} onChange={event => setEditVisibility(event.target.value as AdminGroupItem['visibility'])} style={inputStyle}>
                    <option value="public">Public</option>
                    <option value="unlisted">Unlisted</option>
                    <option value="private">Private</option>
                  </select>
                  <select value={editJoinPolicy} onChange={event => setEditJoinPolicy(event.target.value as AdminGroupItem['joinPolicy'])} style={inputStyle}>
                    <option value="open">Open</option>
                    <option value="approval_required">Approval required</option>
                    <option value="invite_link">Invite link only</option>
                  </select>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '220px minmax(0, 1fr)', gap: 10 }}>
                  <input value={editLinkLabel} onChange={event => setEditLinkLabel(event.target.value)} placeholder="External label" style={inputStyle} />
                  <input value={editLinkUrl} onChange={event => setEditLinkUrl(event.target.value)} placeholder="https://..." style={inputStyle} />
                </div>
                <button onClick={handleSaveSettings} disabled={actionTarget === 'settings'} style={{ justifySelf: 'start' }}>
                  {actionTarget === 'settings' ? 'Saving...' : 'Save settings'}
                </button>
              </div>

              <GroupMembersPanel
                members={details.members}
                actionTarget={actionTarget}
                onUpdate={handleUpdateMember}
              />

              <GroupAttachmentsPanel
                title="Collaborations"
                items={details.collaborations}
                actionTarget={actionTarget}
                onOpen={item => navigate(`/project/${(item as AdminGroupCollaborationItem).projectId}?collab=${item.id}`)}
                onRemove={item => handleRemoveAttachment('collaboration', item as AdminGroupCollaborationItem)}
              />

              <GroupAttachmentsPanel
                title="Projects"
                items={details.projects}
                actionTarget={actionTarget}
                onOpen={item => navigate(`/project/${item.id}`)}
                onRemove={item => handleRemoveAttachment('project', item as AdminGroupProjectItem)}
              />
            </>
          )}
        </section>
      </div>
    </AdminLayout>
  );
}

function GroupMembersPanel({
  members,
  actionTarget,
  onUpdate
}: {
  members: AdminGroupMemberItem[];
  actionTarget: string | null;
  onUpdate: (
    member: AdminGroupMemberItem,
    updates: { role?: AdminGroupMemberItem['role']; status?: AdminGroupMemberItem['status']; remove?: boolean }
  ) => void;
}) {
  return (
    <div style={{ ...panelStyle, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <h4 style={{ margin: 0 }}>Members ({members.length})</h4>
      {members.length === 0 && <div style={{ opacity: 0.75 }}>No members.</div>}
      {members.map(member => {
        const updating = actionTarget === `member:${member.userId}`;
        return (
          <div key={member.userId} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 120px 130px auto', gap: 8, alignItems: 'center', padding: 10, background: 'rgba(255,255,255,0.05)', borderRadius: 8 }}>
            <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', fontFamily: 'monospace', fontSize: 12 }}>{member.userId}</span>
            <select value={member.role} disabled={updating} onChange={event => onUpdate(member, { role: event.target.value as AdminGroupMemberItem['role'] })} style={inputStyle}>
              <option value="owner">Owner</option>
              <option value="admin">Admin</option>
              <option value="member">Member</option>
            </select>
            <select value={member.status} disabled={updating} onChange={event => onUpdate(member, { status: event.target.value as AdminGroupMemberItem['status'] })} style={inputStyle}>
              <option value="active">Active</option>
              <option value="requested">Requested</option>
            </select>
            <button onClick={() => onUpdate(member, { remove: true })} disabled={updating} style={{ background: '#ff5c5c', color: 'white' }}>
              Remove
            </button>
          </div>
        );
      })}
    </div>
  );
}

function GroupAttachmentsPanel<T extends AdminGroupProjectItem | AdminGroupCollaborationItem>({
  title,
  items,
  actionTarget,
  onOpen,
  onRemove
}: {
  title: string;
  items: T[];
  actionTarget: string | null;
  onOpen: (item: T) => void;
  onRemove: (item: T) => void;
}) {
  const kind = title === 'Projects' ? 'project' : 'collaboration';
  return (
    <div style={{ ...panelStyle, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <h4 style={{ margin: 0 }}>{title} ({items.length})</h4>
      {items.length === 0 && <div style={{ opacity: 0.75 }}>No linked {title.toLowerCase()}.</div>}
      {items.map(item => {
        const updating = actionTarget === `${kind}:${item.id}`;
        const collab = item as AdminGroupCollaborationItem;
        return (
          <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', padding: 10, background: 'rgba(255,255,255,0.05)', borderRadius: 8 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name || item.id}</div>
              <div style={{ opacity: 0.7, fontSize: 12 }}>
                {'status' in item ? `${collab.status} · submit ${collab.submitAccess} · vote ${collab.voteAccess}` : `owner ${(item as AdminGroupProjectItem).ownerId || 'unknown'}`}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => onOpen(item)}>Open</button>
              <button onClick={() => onRemove(item)} disabled={updating} style={{ background: '#ff5c5c', color: 'white' }}>
                {updating ? 'Removing...' : 'Remove'}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
