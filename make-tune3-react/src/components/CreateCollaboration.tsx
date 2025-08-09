import { useState } from 'react';
import type { Collaboration } from '../types/collaboration';
import { CollaborationService } from '../services/collaborationService';
import { Potentiometer } from './Potentiometer';
import { AnalogVUMeter } from './AnalogVUMeter';

export function CreateCollaboration({ projectId, onCreated }: { projectId: string; onCreated: (c: Collaboration) => void }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [submissionDuration, setSubmissionDuration] = useState<number>(604800);
  const [votingDuration, setVotingDuration] = useState<number>(259200);
  const [backingFile, setBackingFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<number>(0);

  const create = async () => {
    const trimmed = name.trim();
    if (!trimmed) { setError('name required'); return; }
    setSaving(true); setError(null);
    try {
      // Compute absolute close times for MVP
      const now = Date.now();
      const submissionCloseAt = new Date(now + submissionDuration * 1000);
      const votingCloseAt = new Date(submissionCloseAt.getTime() + votingDuration * 1000);

      // Create the collaboration first to get its id for backing path
      const collab = await CollaborationService.createCollaboration({
        projectId,
        name: trimmed,
        description,
        backingTrackPath: '',
        submissionPaths: [],
        submissionDuration,
        votingDuration,
        submissionCloseAt: submissionCloseAt as any,
        votingCloseAt: votingCloseAt as any,
        status: 'unpublished',
        publishedAt: null
      });
      if (backingFile) {
        setProgress(0);
        const backingPath = await CollaborationService.uploadBackingTrack(backingFile, collab.id, (p) => setProgress(p));
        await CollaborationService.updateCollaboration(collab.id, { backingTrackPath: backingPath });
      }
      onCreated(collab);
      setName('');
      setDescription('');
      setSubmissionDuration(604800);
      setVotingDuration(259200);
      setBackingFile(null);
      setProgress(0);
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
      <div style={{ display: 'flex', gap: 16 }}>
        <div style={{ flex: 1 }}>
          <Potentiometer
            label="submission duration (s)"
            value={submissionDuration}
            min={60}
            max={60 * 60 * 24 * 14}
            step={60}
            onChange={setSubmissionDuration}
          />
        </div>
        <div style={{ flex: 1 }}>
          <Potentiometer
            label="voting duration (s)"
            value={votingDuration}
            min={60}
            max={60 * 60 * 24 * 14}
            step={60}
            onChange={setVotingDuration}
            onInput={setVotingDuration}
          />
          <div style={{ marginTop: 8, display: 'flex', justifyContent: 'center' }}>
            <AnalogVUMeter value={votingDuration} min={60} max={60 * 60 * 24 * 14} label="voting duration" />
          </div>
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {saving && backingFile && (
          <div style={{ width: 180, height: 8, background: 'rgba(255,255,255,0.15)', borderRadius: 4 }}>
            <div style={{ width: `${progress}%`, height: '100%', background: 'var(--contrast-600)', borderRadius: 4 }} />
          </div>
        )}
        <button onClick={create} disabled={saving}>{saving ? (backingFile ? `uploading ${progress}%` : 'creating...') : 'create collaboration'}</button>
      </div>
    </div>
  );
}

