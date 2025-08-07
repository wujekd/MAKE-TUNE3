import { useState } from 'react';
import type { Collaboration } from '../types/collaboration';
import { CollaborationService } from '../services/collaborationService';

export function CreateCollaboration({ projectId, onCreated }: { projectId: string; onCreated: (c: Collaboration) => void }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [submissionDuration, setSubmissionDuration] = useState<number>(604800);
  const [votingDuration, setVotingDuration] = useState<number>(259200);
  const [backingFile, setBackingFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = async () => {
    const trimmed = name.trim();
    if (!trimmed) { setError('name required'); return; }
    setSaving(true); setError(null);
    try {
      let backingPath = '';
      if (backingFile) {
        backingPath = await CollaborationService.uploadBackingTrack(backingFile, projectId);
      }
      const collab = await CollaborationService.createCollaboration({
        projectId,
        name: trimmed,
        description,
        backingTrackPath: backingPath,
        submissionPaths: [],
        submissionDuration,
        votingDuration,
        status: 'unpublished',
        publishedAt: null
      });
      onCreated(collab);
      setName('');
      setDescription('');
      setSubmissionDuration(604800);
      setVotingDuration(259200);
      setBackingFile(null);
    } catch (e: any) {
      setError(e?.message || 'failed to create');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <input
        placeholder="name"
        value={name}
        onChange={e => setName(e.target.value)}
        disabled={saving}
        style={{ padding: 8, borderRadius: 6, border: '1px solid var(--primary1-800)', background: 'var(--primary1-800)', color: 'var(--white)' }}
      />
      <textarea
        placeholder="description"
        value={description}
        onChange={e => setDescription(e.target.value)}
        disabled={saving}
        rows={3}
        style={{ padding: 8, borderRadius: 6, border: '1px solid var(--primary1-800)', background: 'var(--primary1-800)', color: 'var(--white)', resize: 'vertical' }}
      />
      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
          <label style={{ fontSize: 12, opacity: 0.8, color: 'var(--white)' }}>submission duration (s)</label>
          <input type="number" value={submissionDuration} onChange={e => setSubmissionDuration(Number(e.target.value))} disabled={saving} style={{ padding: 8, borderRadius: 6, border: '1px solid var(--primary1-800)', background: 'var(--primary1-800)', color: 'var(--white)' }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
          <label style={{ fontSize: 12, opacity: 0.8, color: 'var(--white)' }}>voting duration (s)</label>
          <input type="number" value={votingDuration} onChange={e => setVotingDuration(Number(e.target.value))} disabled={saving} style={{ padding: 8, borderRadius: 6, border: '1px solid var(--primary1-800)', background: 'var(--primary1-800)', color: 'var(--white)' }} />
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <label style={{ fontSize: 12, opacity: 0.8, color: 'var(--white)' }}>backing track</label>
        <input
          type="file"
          accept="audio/*"
          onChange={(e) => setBackingFile(e.target.files && e.target.files[0] ? e.target.files[0] : null)}
          disabled={saving}
          style={{ padding: 8, borderRadius: 6, border: '1px solid var(--primary1-800)', background: 'var(--primary1-800)', color: 'var(--white)' }}
        />
        {backingFile && (
          <div style={{ color: 'var(--white)', fontSize: 12, opacity: 0.8 }}>{backingFile.name}</div>
        )}
      </div>
      {error && <div style={{ color: 'var(--white)' }}>{error}</div>}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={create} disabled={saving}>{saving ? 'creating...' : 'create collaboration'}</button>
      </div>
    </div>
  );
}

