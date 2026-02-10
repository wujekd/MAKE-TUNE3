import { useEffect, useState } from 'react';
import type { Collaboration } from '../types/collaboration';
import { CollaborationService, SubmissionService } from '../services';
import { FileService } from '../services/fileService';
import { Potentiometer } from './Potentiometer';
import { DeskToggle } from './DeskToggle';
import { TagInput } from './TagInput';
import { TagUtils } from '../utils/tagUtils';
import { TimerDisplay } from './TimerDisplay';
import { TimeUtils } from '../utils/timeUtils';
import { usePlaybackStore } from '../stores/usePlaybackStore';
import { useAudioStore, useAppStore } from '../stores';

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
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [resourcesZipFile, setResourcesZipFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<number>(0);
  const [replaceBacking, setReplaceBacking] = useState<boolean>(false);
  const [replacePdf, setReplacePdf] = useState<boolean>(false);
  const [replaceZip, setReplaceZip] = useState<boolean>(false);
  const previewBackingFile = usePlaybackStore(s => s.previewBackingFile);
  const playBackingTrack = usePlaybackStore(s => s.playBackingTrack);
  const stopBackingPlayback = usePlaybackStore(s => s.stopBackingPlayback);
  const backingPreview = usePlaybackStore(s => s.backingPreview);
  const audioState = useAudioStore(s => s.state);
  const togglePlayPause = useAppStore(s => s.playback.togglePlayPause);
  const user = useAppStore(s => s.auth.user);

  // removed textual duration display helper

  useEffect(() => {
    if (mode === 'edit' && initial) {
      setName(initial.name || '');
      setDescription(initial.description || '');
      setTags(initial.tags || []);
      setSubmissionDuration(initial.submissionDuration || 604800);
      setVotingDuration(initial.votingDuration || 259200);

    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, initial?.id]);
  useEffect(() => {
    return () => {
      stopBackingPlayback();
    };
  }, [stopBackingPlayback]);

  const create = async () => {
    const trimmed = name.trim();
    if (!trimmed) { setError('name required'); return; }
    if (!user?.uid) { setError('sign in required'); return; }

    const normalized = TagUtils.normalizeTags(tags);
    if (mode === 'create' && normalized.display.length === 0) {
      setError('at least one tag required');
      return;
    }
    const isPublished = initial?.status !== 'unpublished';

    setSaving(true); setError(null);
    try {
      if (mode === 'edit' && initial) {
        const updates: any = {
          name: trimmed,
          description,
          submissionDuration,
          votingDuration
        };

        if (!isPublished) {
          updates.tags = normalized.display;
          updates.tagsKey = normalized.keys;
        }

        await CollaborationService.updateCollaboration(initial.id, updates);
        let updated: Collaboration = { ...initial, ...updates } as any;
        if (backingFile) {
          setProgress(0);
          const backingPath = await SubmissionService.uploadBackingTrack(backingFile, initial.id, user.uid, (p) => setProgress(p));
          await CollaborationService.updateCollaboration(initial.id, { backingTrackPath: backingPath });
          updated = { ...updated, backingTrackPath: backingPath } as any;
        }
        if (pdfFile) {
          const pdfPath = await FileService.uploadPdf(pdfFile, initial.id);
          await CollaborationService.updateCollaboration(initial.id, { pdfPath });
          updated = { ...updated, pdfPath } as any;
        }
        if (resourcesZipFile) {
          const resourcesZipPath = await FileService.uploadResourcesZip(resourcesZipFile, initial.id);
          await CollaborationService.updateCollaboration(initial.id, { resourcesZipPath });
          updated = { ...updated, resourcesZipPath } as any;
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
          submissionDuration,
          votingDuration,
          status: 'unpublished',
          publishedAt: null
        } as any);
        if (backingFile) {
          setProgress(0);
          const backingPath = await SubmissionService.uploadBackingTrack(backingFile, collab.id, user.uid, (p) => setProgress(p));
          await CollaborationService.updateCollaboration(collab.id, { backingTrackPath: backingPath });
          (collab as any).backingTrackPath = backingPath;
        }
        if (pdfFile) {
          const pdfPath = await FileService.uploadPdf(pdfFile, collab.id);
          await CollaborationService.updateCollaboration(collab.id, { pdfPath });
          (collab as any).pdfPath = pdfPath;
        }
        if (resourcesZipFile) {
          const resourcesZipPath = await FileService.uploadResourcesZip(resourcesZipFile, collab.id);
          await CollaborationService.updateCollaboration(collab.id, { resourcesZipPath });
          (collab as any).resourcesZipPath = resourcesZipPath;
        }
        onCreated(collab);
      }
      stopBackingPlayback();
      setName('');
      setDescription('');
      setTags([]);
      setSubmissionDuration(604800);
      setVotingDuration(259200);
      setBackingFile(null);
      setPdfFile(null);
      setResourcesZipFile(null);
      setProgress(0);
      setReplacePdf(false);
      setReplaceZip(false);
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
      gap: 12,
      width: '100%',
      // Using a slightly more transparent background for the form container itself if needed, 
      // but here we just stick to the layout changes requested.
      padding: 4 // tiny padding
    }}>
      <input
        placeholder="Collaboration Name"
        value={name}
        onChange={e => setName(e.target.value)}
        disabled={saving}
        style={{
          padding: '10px 12px',
          borderRadius: 8,
          border: '1px solid var(--primary1-600)',
          background: 'var(--primary1-900)',
          color: 'var(--white)',
          fontSize: 15,
          fontWeight: 500
        }}
      />
      <textarea
        placeholder="Description"
        value={description}
        onChange={e => setDescription(e.target.value)}
        disabled={saving}
        rows={2}
        style={{
          padding: '10px 12px',
          borderRadius: 8,
          border: '1px solid var(--primary1-600)',
          background: 'var(--primary1-900)',
          color: 'var(--white)',
          resize: 'vertical',
          minHeight: 60,
          fontFamily: 'inherit'
        }}
      />
      <TagInput
        tags={tags}
        onChange={setTags}
        disabled={saving || (mode === 'edit' && initial?.status !== 'unpublished')}
        placeholder="Add tags..."
      />
      {mode === 'edit' && initial?.status !== 'unpublished' && (
        <div style={{ color: 'var(--white)', opacity: 0.6, fontSize: 11, fontStyle: 'italic', marginTop: -4 }}>
          Tags cannot be edited after publication
        </div>
      )}

      {/* Duration Controls - Side by Side, Compact */}
      <div style={{ display: 'flex', gap: 24, padding: '8px 0', alignItems: 'flex-start' }}>
        {/* Submission Duration */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
            textAlign: 'right',
            fontSize: 13,
            fontWeight: 500,
            color: 'var(--primary1-100)',
            lineHeight: 1.2
          }}>
            <span>Submission</span>
            <span>Duration</span>
          </div>
          <div style={{ position: 'relative' }}>
            <Potentiometer
              value={submissionDuration}
              min={60}
              max={60 * 60 * 24 * 14}
              step={60}
              onChange={val => setSubmissionDuration(TimeUtils.clampDuration(val))}
              onInput={val => setSubmissionDuration(TimeUtils.clampDuration(val))}
              showValue={false}
              size={48}
            />
          </div>
          {/* Timer Display next to it or below? request said "save vertical space" 
               Let's put it to the right of the knob for max compactness or below if it fits better. 
               Let's try compact vertical stack next to the knob.
           */}
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', marginLeft: 4 }}>
            {(() => {
              const { days, hours, minutes } = TimeUtils.formatCountdown(Date.now() / 1000 + submissionDuration);
              // Custom compact display
              return (
                <div style={{ fontSize: 12, color: 'var(--primary1-200)', fontVariantNumeric: 'tabular-nums' }}>
                  {days > 0 && <span>{days}d </span>}
                  {hours > 0 && <span>{hours}h </span>}
                  <span>{minutes}m</span>
                </div>
              );
            })()}
            <div style={{ fontSize: 10, opacity: 0.5, color: 'var(--white)' }}>&nbsp;</div>
          </div>
        </div>

        {/* Voting Duration */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
            textAlign: 'right',
            fontSize: 13,
            fontWeight: 500,
            color: 'var(--primary1-100)',
            lineHeight: 1.2
          }}>
            <span>Voting</span>
            <span>Duration</span>
          </div>
          <div style={{ position: 'relative' }}>
            <Potentiometer
              value={votingDuration}
              min={60}
              max={60 * 60 * 24 * 14}
              step={60}
              onChange={val => setVotingDuration(TimeUtils.clampDuration(val))}
              onInput={val => setVotingDuration(TimeUtils.clampDuration(val))}
              showValue={false}
              size={48}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', marginLeft: 4 }}>
            {(() => {
              const { days, hours, minutes } = TimeUtils.formatCountdown(Date.now() / 1000 + votingDuration);
              return (
                <div style={{ fontSize: 12, color: 'var(--primary1-200)', fontVariantNumeric: 'tabular-nums' }}>
                  {days > 0 && <span>{days}d </span>}
                  {hours > 0 && <span>{hours}h </span>}
                  <span>{minutes}m</span>
                </div>
              );
            })()}
            <div style={{ fontSize: 10, opacity: 0.5, color: 'var(--white)' }}>&nbsp;</div>
          </div>
        </div>
      </div>

      {/* Upload Sections - Inline */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

        {/* Backing Track */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: 8,
          // slightly lighter/different bg for distinct sections
          background: 'rgba(255,255,255,0.03)',
          borderRadius: 8,
          border: '1px solid var(--primary1-600)'
        }}>
          <div style={{ width: 100, fontSize: 12, fontWeight: 600, color: 'var(--primary1-200)', flexShrink: 0 }}>
            Backing Track
          </div>

          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
            {mode === 'edit' && initial?.backingTrackPath && !replaceBacking ? (
              <>
                <div style={{
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  color: 'var(--white)',
                  fontSize: 13,
                  flex: 1
                }}>
                  {decodeURIComponent((initial.backingTrackPath || '').split('/').pop() || '')}
                </div>

                {/* Play/Pause Button for existing track */}
                <button
                  onClick={() => {
                    const backingPath = initial.backingTrackPath;
                    if (!backingPath) return;
                    const isCurrent = backingPreview?.path === backingPath;
                    const isPlaying = isCurrent && !!audioState?.player2.isPlaying;
                    if (isCurrent) {
                      if (isPlaying) stopBackingPlayback();
                      else togglePlayPause();
                    } else {
                      playBackingTrack(backingPath, initial.name || 'backing');
                    }
                  }}
                  style={{
                    background: 'transparent',
                    border: '1px solid var(--primary1-400)',
                    borderRadius: 4,
                    color: 'var(--primary1-200)',
                    cursor: 'pointer',
                    padding: '2px 8px',
                    fontSize: 11
                  }}
                >
                  {initial.backingTrackPath
                    ? (backingPreview?.path === initial.backingTrackPath
                      ? (audioState?.player2.isPlaying ? 'Pause' : 'Resume')
                      : 'Play')
                    : 'No audio'}
                </button>

                <button
                  onClick={() => { setReplaceBacking(true); setBackingFile(null); stopBackingPlayback(); }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--dashboard-accent)',
                    fontSize: 11,
                    cursor: 'pointer',
                    textDecoration: 'underline'
                  }}
                >
                  Replace
                </button>
              </>
            ) : (
              <>
                <label
                  style={{
                    flex: 1,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    overflow: 'hidden'
                  }}
                >
                  <div style={{
                    padding: '4px 8px',
                    background: 'var(--primary1-800)',
                    border: '1px solid var(--primary1-500)',
                    borderRadius: 4,
                    fontSize: 11,
                    color: 'var(--primary1-200)',
                    whiteSpace: 'nowrap'
                  }}>
                    Choose File
                  </div>
                  <input
                    type="file"
                    accept="audio/*"
                    onChange={(e) => {
                      const file = e.target.files && e.target.files[0] ? e.target.files[0] : null;
                      setBackingFile(file);
                      if (file) previewBackingFile(file);
                      else stopBackingPlayback();
                    }}
                    disabled={saving}
                    style={{ display: 'none' }}
                  />
                  <div style={{
                    fontSize: 12,
                    color: 'var(--white)',
                    opacity: backingFile ? 1 : 0.5,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}>
                    {backingFile ? backingFile.name : 'No file selected'}
                  </div>
                </label>
                {/* Cancel Replace Button */}
                {mode === 'edit' && replaceBacking && (
                  <button
                    onClick={() => setReplaceBacking(false)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--white)',
                      fontSize: 11,
                      cursor: 'pointer',
                      opacity: 0.7
                    }}
                  >
                    Cancel
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* PDF */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: 8,
          background: 'rgba(255,255,255,0.03)',
          borderRadius: 8,
          border: '1px solid var(--primary1-600)'
        }}>
          <div style={{ width: 100, fontSize: 12, fontWeight: 600, color: 'var(--primary1-200)', flexShrink: 0 }}>
            PDF
            <span style={{ display: 'block', fontSize: 9, opacity: 0.6, fontWeight: 400 }}>optional</span>
          </div>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
            {mode === 'edit' && initial?.pdfPath && !replacePdf ? (
              <>
                <span style={{
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  color: 'var(--white)',
                  fontSize: 13,
                  flex: 1
                }}>
                  {decodeURIComponent((initial.pdfPath || '').split('/').pop() || 'instructions.pdf')}
                </span>
                <button
                  onClick={() => setReplacePdf(true)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--dashboard-accent)',
                    fontSize: 11,
                    cursor: 'pointer',
                    textDecoration: 'underline'
                  }}
                >
                  Replace
                </button>
              </>
            ) : (
              <>
                <label
                  style={{
                    flex: 1,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    overflow: 'hidden'
                  }}
                >
                  <div style={{
                    padding: '4px 8px',
                    background: 'var(--primary1-800)',
                    border: '1px solid var(--primary1-500)',
                    borderRadius: 4,
                    fontSize: 11,
                    color: 'var(--primary1-200)',
                    whiteSpace: 'nowrap'
                  }}>
                    Choose File
                  </div>
                  <input
                    type="file"
                    accept=".pdf,application/pdf"
                    onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
                    disabled={saving}
                    style={{ display: 'none' }}
                  />
                  <div style={{
                    fontSize: 12,
                    color: 'var(--white)',
                    opacity: pdfFile ? 1 : 0.5,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}>
                    {pdfFile ? pdfFile.name : 'No file selected'}
                  </div>
                </label>
                {mode === 'edit' && replacePdf && (
                  <button
                    onClick={() => setReplacePdf(false)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--white)',
                      fontSize: 11,
                      cursor: 'pointer',
                      opacity: 0.7
                    }}
                  >
                    Cancel
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Resources ZIP */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: 8,
          background: 'rgba(255,255,255,0.03)',
          borderRadius: 8,
          border: '1px solid var(--primary1-600)'
        }}>
          <div style={{ width: 100, fontSize: 12, fontWeight: 600, color: 'var(--primary1-200)', flexShrink: 0 }}>
            Resources ZIP
            <span style={{ display: 'block', fontSize: 9, opacity: 0.6, fontWeight: 400 }}>optional</span>
          </div>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
            {mode === 'edit' && initial?.resourcesZipPath && !replaceZip ? (
              <>
                <span style={{
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  color: 'var(--white)',
                  fontSize: 13,
                  flex: 1
                }}>
                  {decodeURIComponent((initial.resourcesZipPath || '').split('/').pop() || 'resources.zip')}
                </span>
                <button
                  onClick={() => setReplaceZip(true)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--dashboard-accent)',
                    fontSize: 11,
                    cursor: 'pointer',
                    textDecoration: 'underline'
                  }}
                >
                  Replace
                </button>
              </>
            ) : (
              <>
                <label
                  style={{
                    flex: 1,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    overflow: 'hidden'
                  }}
                >
                  <div style={{
                    padding: '4px 8px',
                    background: 'var(--primary1-800)',
                    border: '1px solid var(--primary1-500)',
                    borderRadius: 4,
                    fontSize: 11,
                    color: 'var(--primary1-200)',
                    whiteSpace: 'nowrap'
                  }}>
                    Choose File
                  </div>
                  <input
                    type="file"
                    accept=".zip,application/zip,application/x-zip-compressed"
                    onChange={(e) => setResourcesZipFile(e.target.files?.[0] || null)}
                    disabled={saving}
                    style={{ display: 'none' }}
                  />
                  <div style={{
                    fontSize: 12,
                    color: 'var(--white)',
                    opacity: resourcesZipFile ? 1 : 0.5,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}>
                    {resourcesZipFile ? resourcesZipFile.name : 'No file selected'}
                  </div>
                </label>
                {mode === 'edit' && replaceZip && (
                  <button
                    onClick={() => setReplaceZip(false)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--white)',
                      fontSize: 11,
                      cursor: 'pointer',
                      opacity: 0.7
                    }}
                  >
                    Cancel
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {error && <div style={{ color: 'var(--dashboard-accent)', fontSize: 13, marginTop: 4 }}>{error}</div>}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
        {saving && backingFile && (
          <div style={{ width: 180, height: 6, background: 'rgba(255,255,255,0.1)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ width: `${progress}%`, height: '100%', background: 'var(--dashboard-accent)', transition: 'width 0.2s' }} />
          </div>
        )}
        <div style={{ flex: 1 }}></div>
        <button
          onClick={create}
          disabled={saving}
          style={{
            background: 'linear-gradient(135deg, var(--dashboard-accent) 0%, var(--contrast-600) 100%)',
            border: 'none',
            borderRadius: 8,
            color: 'white',
            padding: '8px 20px',
            fontWeight: 600,
            opacity: saving ? 0.7 : 1,
            cursor: saving ? 'wait' : 'pointer',
            fontSize: 13,
            boxShadow: '0 4px 12px rgba(213, 95, 33, 0.2)'
          }}
        >
          {saving ? (backingFile ? `Uploading ${Math.round(progress)}%` : (mode === 'edit' ? 'Saving...' : 'Creating...')) : (mode === 'edit' ? 'Save Changes' : 'Create Collaboration')}
        </button>
      </div>
    </div>
  );
}
