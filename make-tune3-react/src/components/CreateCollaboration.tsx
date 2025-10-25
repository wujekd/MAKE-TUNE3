import { useEffect, useState } from 'react';
import type { Collaboration } from '../types/collaboration';
import { CollaborationService, SubmissionService } from '../services';
import { Potentiometer } from './Potentiometer';
// removed AnalogVUMeter
import { DeskToggle } from './DeskToggle';

type Props = {
  projectId: string;
  onCreated: (c: Collaboration) => void;
  mode?: 'create' | 'edit';
  initial?: Collaboration | null;
  onSaved?: (c: Collaboration) => void;
};

export function CreateCollaboration({ projectId, onCreated, mode = 'create', initial = null, onSaved }: Props) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [submissionDuration, setSubmissionDuration] = useState<number>(604800);
  const [votingDuration, setVotingDuration] = useState<number>(259200);
  const [backingFile, setBackingFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<number>(0);
  const [requiresModeration, setRequiresModeration] = useState<boolean>(true);
  const [replaceBacking, setReplaceBacking] = useState<boolean>(false);

  // removed textual duration display helper

  const splitDuration = (seconds: number) => {
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return { d, h, m };
  };

  const clampDurationSec = (sec: number) => {
    const min = 60;
    const max = 60 * 60 * 24 * 14;
    return Math.max(min, Math.min(max, sec));
  };

  const combineDuration = (d: number, h: number, m: number) => {
    const dd = Math.max(0, Math.min(14, Math.floor(d)));
    const hh = Math.max(0, Math.min(23, Math.floor(h)));
    const mm = Math.max(0, Math.min(59, Math.floor(m)));
    return clampDurationSec(dd * 86400 + hh * 3600 + mm * 60);
  };

  useEffect(() => {
    if (mode === 'edit' && initial) {
      setName(initial.name || '');
      setDescription(initial.description || '');
      setSubmissionDuration(initial.submissionDuration || 604800);
      setVotingDuration(initial.votingDuration || 259200);
      setRequiresModeration(!!initial.requiresModeration);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, initial?.id]);

  const create = async () => {
    const trimmed = name.trim();
    if (!trimmed) { setError('name required'); return; }
    setSaving(true); setError(null);
    try {
      if (mode === 'edit' && initial) {
        await CollaborationService.updateCollaboration(initial.id, {
          name: trimmed,
          description,
          submissionDuration,
          votingDuration,
          requiresModeration
        } as any);
        let updated: Collaboration = { ...initial, name: trimmed, description, submissionDuration, votingDuration, requiresModeration } as any;
        if (backingFile) {
          setProgress(0);
          const backingPath = await SubmissionService.uploadBackingTrack(backingFile, initial.id, (p) => setProgress(p));
          await CollaborationService.updateCollaboration(initial.id, { backingTrackPath: backingPath });
          updated = { ...updated, backingTrackPath: backingPath } as any;
        }
        onSaved?.(updated);
      } else {
        // Create flow: status unpublished; closeAt computed later on publish
        const collab = await CollaborationService.createCollaboration({
          projectId,
          name: trimmed,
          description,
          backingTrackPath: '',
          submissionPaths: [],
          submissionDuration,
          votingDuration,
          requiresModeration,
          status: 'unpublished',
          publishedAt: null
        } as any);
        if (backingFile) {
          setProgress(0);
          const backingPath = await SubmissionService.uploadBackingTrack(backingFile, collab.id, (p) => setProgress(p));
          await CollaborationService.updateCollaboration(collab.id, { backingTrackPath: backingPath });
          (collab as any).backingTrackPath = backingPath;
        }
        onCreated(collab);
      }
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
            label="Submission duration:"
            value={submissionDuration}
            min={60}
            max={60 * 60 * 24 * 14}
            step={60}
            onChange={setSubmissionDuration}
            onInput={setSubmissionDuration}
            showValue={false}
          />
          {(() => {
            const { d, h, m } = splitDuration(submissionDuration);
            const setD = (val: number) => setSubmissionDuration(combineDuration(val, h, m));
            const setH = (val: number) => setSubmissionDuration(combineDuration(d, val, m));
            const setM = (val: number) => setSubmissionDuration(combineDuration(d, h, val));
            return (
              <div style={{ marginTop: 6, display: 'flex', gap: 8, alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <input
                    type="number"
                    min={0}
                    max={14}
                    value={d}
                    onChange={(e) => setD(Number(e.target.value))}
                    style={{ width: 30, padding: 4, borderRadius: 6, border: '1px solid var(--primary1-800)', background: 'var(--primary1-800)', color: 'var(--white)' }}
                  />
                  <span style={{ fontSize: 12, color: 'var(--white)', opacity: 0.85 }}>d</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <input
                    type="number"
                    min={0}
                    max={23}
                    value={h}
                    onChange={(e) => setH(Number(e.target.value))}
                    style={{ width: 30, padding: 4, borderRadius: 6, border: '1px solid var(--primary1-800)', background: 'var(--primary1-800)', color: 'var(--white)' }}
                  />
                  <span style={{ fontSize: 12, color: 'var(--white)', opacity: 0.85 }}>h</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <input
                    type="number"
                    min={0}
                    max={59}
                    value={m}
                    onChange={(e) => setM(Number(e.target.value))}
                    style={{ width: 30, padding: 4, borderRadius: 6, border: '1px solid var(--primary1-800)', background: 'var(--primary1-800)', color: 'var(--white)' }}
                  />
                  <span style={{ fontSize: 12, color: 'var(--white)', opacity: 0.85 }}>m</span>
                </div>
              </div>
            );
          })()}
        </div>
        <div style={{ flex: 1 }}>
          <Potentiometer
            label="Voting duration:"
            value={votingDuration}
            min={60}
            max={60 * 60 * 24 * 14}
            step={60}
            onChange={setVotingDuration}
            onInput={setVotingDuration}
            showValue={false}
          />
          {(() => {
            const { d, h, m } = splitDuration(votingDuration);
            const setD = (val: number) => setVotingDuration(combineDuration(val, h, m));
            const setH = (val: number) => setVotingDuration(combineDuration(d, val, m));
            const setM = (val: number) => setVotingDuration(combineDuration(d, h, val));
            return (
              <div style={{ marginTop: 6, display: 'flex', gap: 8, alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <input
                    type="number"
                    min={0}
                    max={14}
                    value={d}
                    onChange={(e) => setD(Number(e.target.value))}
                    style={{ width: 30, padding: 4, borderRadius: 6, border: '1px solid var(--primary1-800)', background: 'var(--primary1-800)', color: 'var(--white)' }}
                  />
                  <span style={{ fontSize: 12, color: 'var(--white)', opacity: 0.85 }}>d</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <input
                    type="number"
                    min={0}
                    max={23}
                    value={h}
                    onChange={(e) => setH(Number(e.target.value))}
                    style={{ width: 30, padding: 4, borderRadius: 6, border: '1px solid var(--primary1-800)', background: 'var(--primary1-800)', color: 'var(--white)' }}
                  />
                  <span style={{ fontSize: 12, color: 'var(--white)', opacity: 0.85 }}>h</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <input
                    type="number"
                    min={0}
                    max={59}
                    value={m}
                    onChange={(e) => setM(Number(e.target.value))}
                    style={{ width: 30, padding: 4, borderRadius: 6, border: '1px solid var(--primary1-800)', background: 'var(--primary1-800)', color: 'var(--white)' }}
                  />
                  <span style={{ fontSize: 12, color: 'var(--white)', opacity: 0.85 }}>m</span>
                </div>
              </div>
            );
          })()}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label style={{ fontSize: 12, opacity: 0.8, color: 'var(--white)' }}>backing track</label>
        {mode === 'edit' && initial?.backingTrackPath ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ color: 'var(--white)', fontSize: 12, opacity: 0.85 }}>
              current track is: {decodeURIComponent((initial.backingTrackPath || '').split('/').pop() || '')}
            </div>
            {!replaceBacking && (
              <div>
                <button onClick={() => { setReplaceBacking(true); setBackingFile(null); }}>
                  replace backing track
                </button>
              </div>
            )}
            {replaceBacking && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
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
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
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
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <DeskToggle checked={requiresModeration} onChange={setRequiresModeration} size={18} onText="moderation" offText="no moderation" colorOff="#b91c1c" />
      </div>
      {error && <div style={{ color: 'var(--white)' }}>{error}</div>}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {saving && backingFile && (
          <div style={{ width: 180, height: 8, background: 'rgba(255,255,255,0.15)', borderRadius: 4 }}>
            <div style={{ width: `${progress}%`, height: '100%', background: 'var(--contrast-600)', borderRadius: 4 }} />
          </div>
        )}
        <button onClick={create} disabled={saving}>{saving ? (backingFile ? `uploading ${progress}%` : (mode==='edit' ? 'saving...' : 'creating...')) : (mode==='edit' ? 'save changes' : 'create collaboration')}</button>
      </div>
    </div>
  );
}

