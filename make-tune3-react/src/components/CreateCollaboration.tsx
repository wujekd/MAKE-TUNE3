import { useEffect, useState } from 'react';
import type { Collaboration } from '../types/collaboration';
import { CollaborationService, SubmissionService } from '../services';
import { Potentiometer } from './Potentiometer';
import { DeskToggle } from './DeskToggle';
import { TagInput } from './TagInput';
import { TagUtils } from '../utils/tagUtils';
import { TimerDisplay } from './TimerDisplay';
import { TimeUtils } from '../utils/timeUtils';

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
  const [tags, setTags] = useState<string[]>([]);
  const [submissionDuration, setSubmissionDuration] = useState<number>(TimeUtils.clampDuration(604800));
  const [votingDuration, setVotingDuration] = useState<number>(TimeUtils.clampDuration(259200));
  const [backingFile, setBackingFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<number>(0);
  const [requiresModeration, setRequiresModeration] = useState<boolean>(true);
  const [replaceBacking, setReplaceBacking] = useState<boolean>(false);

  // removed textual duration display helper

  useEffect(() => {
    if (mode === 'edit' && initial) {
      setName(initial.name || '');
      setDescription(initial.description || '');
      setTags(initial.tags || []);
      setSubmissionDuration(initial.submissionDuration || 604800);
      setVotingDuration(initial.votingDuration || 259200);
      setRequiresModeration(!!initial.requiresModeration);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, initial?.id]);

  const create = async () => {
    const trimmed = name.trim();
    if (!trimmed) { setError('name required'); return; }
    
    const normalized = TagUtils.normalizeTags(tags);
    const isPublished = initial?.status !== 'unpublished';
    
    setSaving(true); setError(null);
    try {
      if (mode === 'edit' && initial) {
        const updates: any = {
          name: trimmed,
          description,
          submissionDuration,
          votingDuration,
          requiresModeration
        };
        
        if (!isPublished) {
          updates.tags = normalized.display;
          updates.tagsKey = normalized.keys;
        }
        
        await CollaborationService.updateCollaboration(initial.id, updates);
        let updated: Collaboration = { ...initial, ...updates } as any;
        if (backingFile) {
          setProgress(0);
          const backingPath = await SubmissionService.uploadBackingTrack(backingFile, initial.id, (p) => setProgress(p));
          await CollaborationService.updateCollaboration(initial.id, { backingTrackPath: backingPath });
          updated = { ...updated, backingTrackPath: backingPath } as any;
        }
        onSaved?.(updated);
      } else {
        const collab = await CollaborationService.createCollaboration({
          projectId,
          name: trimmed,
          description,
          tags: normalized.display,
          tagsKey: normalized.keys,
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
      setTags([]);
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
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      gap: 8,
      width: '100%'
    }}>
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
      <TagInput
        tags={tags}
        onChange={setTags}
        disabled={saving || (mode === 'edit' && initial?.status !== 'unpublished')}
        placeholder="Add tags..."
      />
      {mode === 'edit' && initial?.status !== 'unpublished' && (
        <div style={{ color: 'var(--white)', opacity: 0.7, fontSize: 12 }}>
          Tags cannot be edited after collaboration is published
        </div>
      )}
      <div style={{ display: 'flex', gap: 16 }}>
        <div style={{ flex: 1 }}>
          <Potentiometer
            label="Submission duration:"
            value={submissionDuration}
            min={60}
            max={60 * 60 * 24 * 14}
            step={60}
            onChange={val => setSubmissionDuration(TimeUtils.clampDuration(val))}
            onInput={val => setSubmissionDuration(TimeUtils.clampDuration(val))}
            showValue={false}
          />
          <div style={{ marginTop: 6 }}>
            {(() => {
              const { days, hours, minutes, seconds } = TimeUtils.formatCountdown(Date.now() / 1000 + submissionDuration);
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <TimerDisplay days={days} hours={hours} minutes={minutes} seconds={seconds} />

                </div>
              );
            })()}
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <Potentiometer
            label="Voting duration:"
            value={votingDuration}
            min={60}
            max={60 * 60 * 24 * 14}
            step={60}
            onChange={val => setVotingDuration(TimeUtils.clampDuration(val))}
            onInput={val => setVotingDuration(TimeUtils.clampDuration(val))}
            showValue={false}
          />
          <div style={{ marginTop: 6 }}>
            {(() => {
              const { days, hours, minutes, seconds } = TimeUtils.formatCountdown(Date.now() / 1000 + votingDuration); // now + duration
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <TimerDisplay days={days} hours={hours} minutes={minutes} seconds={seconds} />
                </div>
              );
            })()}
          </div>
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

