import { useState, useEffect, useMemo } from 'react';
import { AdminService } from '../services';
import type { UserSearchResult } from '../services';
import { AdminLayout } from '../components/AdminLayout';

export function AdminUsersView() {
  const [searchQuery, setSearchQuery] = useState('');
  const [allUsers, setAllUsers] = useState<UserSearchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionTarget, setActionTarget] = useState<string | null>(null);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const users = await AdminService.listAllUsers();
      setAllUsers(users);
    } catch (err: any) {
      setError(err?.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return allUsers;
    const query = searchQuery.toLowerCase().trim();
    return allUsers.filter(user =>
      user.email?.toLowerCase().includes(query) ||
      user.username?.toLowerCase().includes(query) ||
      user.uid.toLowerCase().includes(query)
    );
  }, [allUsers, searchQuery]);

  const handleBonusChange = async (userId: string, delta: number) => {
    const user = allUsers.find(u => u.uid === userId);
    if (!user) return;

    const currentBonus = user.bonusProjects ?? 0;
    const newBonus = Math.max(0, currentBonus + delta);

    setActionTarget(userId);
    setError(null);
    try {
      await AdminService.updateUserPermissions(userId, { bonusProjects: newBonus });
      setAllUsers(prev => prev.map(u =>
        u.uid === userId ? { ...u, bonusProjects: newBonus } : u
      ));
    } catch (err: any) {
      setError(err?.message || 'Failed to update bonus');
    } finally {
      setActionTarget(null);
    }
  };

  const handleToggleSuspend = async (userId: string) => {
    const user = allUsers.find(u => u.uid === userId);
    if (!user) return;

    const isSuspended = user.suspended ?? false;

    setActionTarget(userId);
    setError(null);
    try {
      if (isSuspended) {
        await AdminService.unsuspendUser(userId);
      } else {
        await AdminService.suspendUser(userId);
      }
      setAllUsers(prev => prev.map(u =>
        u.uid === userId ? { ...u, suspended: !isSuspended } : u
      ));
    } catch (err: any) {
      setError(err?.message || 'Failed to update suspension');
    } finally {
      setActionTarget(null);
    }
  };

  const formatDate = (timestamp: any): string => {
    if (!timestamp) return 'unknown';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString();
  };

  return (
    <AdminLayout title="User Management">
      <div style={{
        background: 'var(--primary1-700)',
        padding: 16,
        borderRadius: 8,
        display: 'flex',
        gap: 8
      }}>
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Filter by email, username, or UID..."
          style={{
            flex: 1,
            padding: 10,
            background: 'var(--primary1-800)',
            border: '1px solid var(--primary1-500)',
            borderRadius: 4,
            color: 'var(--white)',
            fontSize: 14
          }}
        />
        <button
          onClick={loadUsers}
          disabled={loading}
          style={{ padding: '10px 20px' }}
        >
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      <div style={{ color: 'var(--white)', opacity: 0.7, fontSize: 14 }}>
        {loading ? 'Loading users...' : `Showing ${filteredUsers.length} of ${allUsers.length} users`}
      </div>

      {error && (
        <div style={{
          color: '#ff6b6b',
          background: 'rgba(255,107,107,0.15)',
          padding: 12,
          borderRadius: 6
        }}>
          {error}
        </div>
      )}

      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        flex: 1,
        minHeight: 0,
        overflowY: 'auto',
        paddingRight: 8
      }}>
        {filteredUsers.map(user => {
          const isUpdating = actionTarget === user.uid;
          const isSuspended = user.suspended ?? false;

          return (
            <div
              key={user.uid}
              style={{
                background: isSuspended ? 'rgba(255,100,100,0.15)' : 'var(--primary1-700)',
                borderRadius: 12,
                padding: 16,
                color: 'var(--white)',
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                border: isSuspended ? '1px solid rgba(255,100,100,0.4)' : 'none'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 18, fontWeight: 600 }}>
                      {user.username || user.email}
                    </span>
                    {user.isAdmin && (
                      <span style={{
                        background: 'var(--primary1-500)',
                        padding: '2px 8px',
                        borderRadius: 4,
                        fontSize: 11
                      }}>
                        ADMIN
                      </span>
                    )}
                    {isSuspended && (
                      <span style={{
                        background: '#ff5c5c',
                        padding: '2px 8px',
                        borderRadius: 4,
                        fontSize: 11
                      }}>
                        SUSPENDED
                      </span>
                    )}
                  </div>
                  <span style={{ opacity: 0.85, fontSize: 14 }}>{user.email}</span>
                  <span style={{ opacity: 0.7, fontSize: 12, fontFamily: 'monospace' }}>
                    UID: {user.uid}
                  </span>
                </div>
              </div>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                gap: 12,
                background: 'var(--primary1-600)',
                padding: 12,
                borderRadius: 8
              }}>
                <div>
                  <div style={{ opacity: 0.7, fontSize: 11, marginBottom: 2 }}>Created</div>
                  <div style={{ fontSize: 14 }}>{formatDate(user.createdAt)}</div>
                </div>
                <div>
                  <div style={{ opacity: 0.7, fontSize: 11, marginBottom: 2 }}>Tier</div>
                  <div style={{ fontSize: 14 }}>{user.tier || 'free'}</div>
                </div>
                <div>
                  <div style={{ opacity: 0.7, fontSize: 11, marginBottom: 2 }}>Projects</div>
                  <div style={{ fontSize: 14 }}>{user.projectCount ?? 0}</div>
                </div>
                <div>
                  <div style={{ opacity: 0.7, fontSize: 11, marginBottom: 2 }}>Bonus Allowance</div>
                  <div style={{ fontSize: 14 }}>{user.bonusProjects ?? 0}</div>
                </div>
              </div>

              <div style={{
                display: 'flex',
                gap: 12,
                flexWrap: 'wrap',
                alignItems: 'center'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 13, opacity: 0.85 }}>Bonus Projects:</span>
                  <button
                    onClick={() => handleBonusChange(user.uid, -1)}
                    disabled={isUpdating || (user.bonusProjects ?? 0) <= 0}
                    style={{ padding: '4px 12px', fontSize: 16 }}
                  >
                    −
                  </button>
                  <span style={{ minWidth: 24, textAlign: 'center', fontWeight: 600 }}>
                    {user.bonusProjects ?? 0}
                  </span>
                  <button
                    onClick={() => handleBonusChange(user.uid, 1)}
                    disabled={isUpdating}
                    style={{ padding: '4px 12px', fontSize: 16 }}
                  >
                    +
                  </button>
                </div>

                <button
                  onClick={() => handleToggleSuspend(user.uid)}
                  disabled={isUpdating || user.isAdmin}
                  style={{
                    padding: '6px 16px',
                    background: isSuspended ? '#4CAF50' : '#ff5c5c',
                    color: 'white',
                    border: 'none',
                    borderRadius: 4,
                    cursor: isUpdating || user.isAdmin ? 'not-allowed' : 'pointer',
                    opacity: user.isAdmin ? 0.5 : 1
                  }}
                  title={user.isAdmin ? 'Cannot suspend admins' : ''}
                >
                  {isUpdating ? 'Updating...' : isSuspended ? 'Unsuspend' : 'Suspend'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {!loading && filteredUsers.length === 0 && allUsers.length > 0 && (
        <div style={{ color: 'var(--white)', opacity: 0.75, textAlign: 'center', padding: 40 }}>
          No users match the filter
        </div>
      )}

      {!loading && allUsers.length === 0 && !error && (
        <div style={{ color: 'var(--white)', opacity: 0.75, textAlign: 'center', padding: 40 }}>
          No users found
        </div>
      )}
    </AdminLayout>
  );
}
