import { useEffect, useState } from 'react';
import { useAppStore } from '../stores/appStore';
import { CollaborationService } from '../services/collaborationService';
import './ProjectHistory.css';
import { Link } from 'react-router-dom';

export function MyProjects() {
  const { user } = useAppStore(state => state.auth);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [projects, setProjects] = useState<Array<{ id: string; name: string; createdAt: any }>>([]);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let mounted = true;
    setLoading(true);
    (async () => {
      try {
        const list = await CollaborationService.listUserProjects(user.uid);
        if (mounted) setProjects(list);
      } catch (e: any) {
        if (mounted) setError(e?.message || 'failed to load');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [user]);

  return (
    <div className="project-history card" style={{ maxWidth: 420, width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h4 className="project-history-title card__title" style={{ marginBottom: 0 }}>my projects</h4>
        <button
          style={{
            marginLeft: 8,
            padding: '6px 10px',
            borderRadius: 6,
            border: '1px solid var(--border-color, #333)',
            background: 'var(--primary1-700)',
            color: 'var(--white)',
            opacity: user ? 1 : 0.6,
            cursor: user ? 'pointer' : 'not-allowed'
          }}
          disabled={!user}
          onClick={() => setShowForm(v => !v)}
        >
          + create project
        </button>
      </div>
      <div className="collab-list list" style={{ marginTop: 8 }}>
        {showForm && (
          <div className="collab-history-item list__item" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
            <input
              placeholder="project name"
              value={name}
              onChange={e => setName(e.target.value)}
              disabled={!user || saving}
              style={{ padding: 8, borderRadius: 6, border: '1px solid var(--primary1-800)', background: 'var(--primary1-800)', color: 'var(--white)' }}
            />
            <textarea
              placeholder="description (optional)"
              value={description}
              onChange={e => setDescription(e.target.value)}
              disabled={!user || saving}
              rows={3}
              style={{ padding: 8, borderRadius: 6, border: '1px solid var(--primary1-800)', background: 'var(--primary1-800)', color: 'var(--white)', resize: 'vertical' }}
            />
            {formError && <div style={{ color: 'var(--white)' }}>{formError}</div>}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={() => { setShowForm(false); setName(''); setDescription(''); setFormError(null); }}
                disabled={saving}
              >
                cancel
              </button>
              <button
                onClick={async () => {
                  if (!user) return;
                  const trimmed = name.trim();
                  if (!trimmed) { setFormError('name required'); return; }
                  if (trimmed.length > 80) { setFormError('name too long'); return; }
                  if (description.length > 500) { setFormError('description too long'); return; }
                  setSaving(true); setFormError(null);
                  try {
                    const p = await CollaborationService.createProjectWithUniqueName({ name: trimmed, description, ownerId: user.uid });
                    setProjects(prev => [{ id: p.id, name: p.name, createdAt: (p as any).createdAt }, ...prev]);
                    setShowForm(false); setName(''); setDescription('');
                  } catch (e: any) {
                    const msg = e?.message || 'failed to create';
                    if (/name already taken/i.test(msg)) {
                      setFormError('Name already taken. Please choose a different name.');
                    } else {
                      setFormError(msg);
                    }
                  } finally {
                    setSaving(false);
                  }
                }}
                disabled={!user || saving}
              >
                {saving ? 'creating...' : 'create'}
              </button>
            </div>
          </div>
        )}
        {!user && (
          <div style={{ color: 'var(--white)' }}>login to see your projects</div>
        )}
        {user && loading && <div style={{ color: 'var(--white)' }}>loading...</div>}
        {user && error && <div style={{ color: 'var(--white)' }}>{error}</div>}
        {user && !loading && !error && projects.length === 0 && (
          <div style={{ color: 'var(--white)' }}>no projects</div>
        )}
        {user && projects.map(p => (
          <Link key={p.id} to={`/project/${p.id}`} className="collab-history-item list__item" style={{ textDecoration: 'none' }}>
            <div className="collab-name list__title">{p.name}</div>
            <div className="collab-stage list__subtitle">
              {new Date((p as any).createdAt?.toMillis ? (p as any).createdAt.toMillis() : (p as any).createdAt).toLocaleString()}
            </div>
            <span
              style={{
                marginLeft: 'auto',
                padding: '4px 8px',
                borderRadius: 6,
                border: '1px solid var(--border-color, #333)',
                background: 'var(--primary1-800)',
                color: 'var(--white)'
              }}
            >
              edit
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

