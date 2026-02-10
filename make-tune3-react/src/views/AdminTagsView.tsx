import { useEffect, useState } from 'react';
import { TagService } from '../services';
import type { Tag } from '../types/collaboration';
import { db } from '../services/firebase';
import { collection, addDoc, deleteDoc, doc, Timestamp } from 'firebase/firestore';
import { COLLECTIONS } from '../types/collaboration';
import { TagUtils } from '../utils/tagUtils';
import { AdminNav } from '../components/AdminNav';

export function AdminTagsView() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTagName, setNewTagName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  

  useEffect(() => {
    loadTags();
  }, []);


  const loadTags = async () => {
    setLoading(true);
    try {
      const allTags = await TagService.getAllTags();
      setTags(allTags);
    } catch (e: any) {
      setError(e?.message || 'Failed to load tags');
    } finally {
      setLoading(false);
    }
  };

  const handleAddTag = async () => {
    const trimmed = newTagName.trim();
    if (!trimmed) return;

    const validation = TagUtils.validateTag(trimmed);
    if (!validation.valid) {
      setError(validation.error || 'Invalid tag');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const normalized = TagUtils.normalizeTag(trimmed);
      const now = Timestamp.now();

      await addDoc(collection(db, COLLECTIONS.TAGS), {
        name: trimmed,
        key: normalized,
        projectCount: 0,
        collaborationCount: 0,
        createdAt: now,
        lastUpdatedAt: now
      });

      setNewTagName('');
      await loadTags();
    } catch (e: any) {
      setError(e?.message || 'Failed to add tag');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTag = async (tagKey: string) => {
    if (!confirm(`Delete tag "${tagKey}"? This cannot be undone.`)) return;

    setSaving(true);
    setError(null);

    try {
      await deleteDoc(doc(db, COLLECTIONS.TAGS, tagKey));
      await loadTags();
    } catch (e: any) {
      setError(e?.message || 'Failed to delete tag');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ padding: 24, background: 'var(--primary1-800)', minHeight: '100vh' }}>
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        <AdminNav />
        <h2 style={{ color: 'var(--white)', marginBottom: 24 }}>Manage Tags</h2>

        <div style={{ background: 'var(--primary1-700)', padding: 16, borderRadius: 8, marginBottom: 24 }}>
          <h3 style={{ color: 'var(--white)', marginBottom: 12 }}>Add New Tag</h3>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="text"
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
              placeholder="Tag name"
              disabled={saving}
              style={{
                flex: 1,
                padding: 8,
                background: 'var(--primary1-800)',
                border: '1px solid var(--primary1-500)',
                borderRadius: 4,
                color: 'var(--white)'
              }}
            />
            <button
              onClick={handleAddTag}
              disabled={saving || !newTagName.trim()}
              style={{ padding: '8px 16px' }}
            >
              {saving ? 'Adding...' : 'Add'}
            </button>
          </div>
          {error && <div style={{ color: '#ff4444', marginTop: 8, fontSize: 14 }}>{error}</div>}
        </div>

        <div style={{ background: 'var(--primary1-700)', padding: 16, borderRadius: 8 }}>
          <h3 style={{ color: 'var(--white)', marginBottom: 12 }}>Existing Tags ({tags.length})</h3>
          
          {loading ? (
            <div style={{ color: 'var(--white)', opacity: 0.7 }}>Loading...</div>
          ) : tags.length === 0 ? (
            <div style={{ color: 'var(--white)', opacity: 0.7 }}>No tags yet</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {tags.map(tag => (
                <div
                  key={tag.key}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: 12,
                    background: 'var(--primary1-600)',
                    borderRadius: 4
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{ color: 'var(--white)', fontWeight: 'bold' }}>{tag.name}</span>
                    <span style={{ color: 'var(--white)', opacity: 0.7, fontSize: 12 }}>
                      Key: {tag.key} | Collabs: {tag.collaborationCount}
                    </span>
                  </div>
                  <button
                    onClick={() => handleDeleteTag(tag.key)}
                    disabled={saving}
                    style={{
                      padding: '6px 12px',
                      background: '#ff4444',
                      border: 'none',
                      borderRadius: 4,
                      color: 'white',
                      cursor: saving ? 'not-allowed' : 'pointer'
                    }}
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
