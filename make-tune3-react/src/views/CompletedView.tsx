import { useContext, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { AudioEngineContext } from '../audio-services/AudioEngineContext';
import { useAppStore } from '../stores/appStore';
import './MainView.css';
import { Mixer } from '../components/Mixer';
import { CollabData } from '../components/CollabData';

export function CompletedView() {
  const { collaborationId } = useParams();
  const { user } = useAppStore(s => s.auth);
  const { currentCollaboration, loadCollaboration, loadCollaborationAnonymousById } = useAppStore(s => s.collaboration);
  const audioCtx = useContext(AudioEngineContext);
  const engine = audioCtx?.engine;

  useEffect(() => {
    if (!collaborationId) return;
    if (user) loadCollaboration(user.uid, collaborationId);
    else loadCollaborationAnonymousById(collaborationId);
  }, [collaborationId, user, loadCollaboration, loadCollaborationAnonymousById]);

  useEffect(() => {
    if (!engine) return;
    engine.setPlaybackTrackingEnabled(false);
    return () => { engine.setPlaybackTrackingEnabled(true); };
  }, [engine]);

  const winner = useMemo(() => {
    if (!currentCollaboration?.winnerPath) return null;
    const path = currentCollaboration.winnerPath;
    const entry = currentCollaboration.submissions?.find(s => s.path === path);
    return { path, settings: entry?.settings };
  }, [currentCollaboration]);

  const results = useMemo(() => {
    const listRaw: any = currentCollaboration?.results;
    const list: Array<{ path: string; votes: number }> = Array.isArray(listRaw) ? listRaw : [];
    const total = list.reduce((a, b) => a + (b?.votes || 0), 0) || 1;
    return list.slice().sort((a, b) => (b?.votes || 0) - (a?.votes || 0)).map((r, i) => ({
      rank: i + 1,
      path: r?.path || '',
      votes: r?.votes || 0,
      pct: Math.round(((r.votes || 0) / total) * 100)
    }));
  }, [currentCollaboration?.results]);

  if (!audioCtx || !audioCtx.state) return <div>audio engine not available</div>;
  const state = audioCtx.state;

  return (
    <div className="main-container">
      <div className="info-top">
        <h2>Completed</h2>
      </div>

      <div className="submissions-section active-playback">
        <div className="audio-player-section">
          {/* Winner/results section replaces favorites/submissions */}
          <section className="favorites-section">
            <div className="favorites-header"><h2 className="favorites-title">Collaboration results</h2></div>
            <div className="favorites-container">
              <div className="favorite-item favorite-placeholder" style={{ outline: '1px dashed rgba(255,255,255,0.2)', minWidth: 280 }}>
                <div style={{ color: 'var(--white)', opacity: 0.9, marginBottom: 8 }}>Winner</div>
                <div style={{ color: 'var(--white)', opacity: 0.8 }}>{winner?.path?.split('/').pop() || 'tbd'}</div>
                <div className="row gap-8 mt-8" style={{ alignItems: 'center' }}>
                  <button
                    onClick={async () => {
                      if (!engine || !winner?.path) return;
                      // optimistic apply settings then play
                      if (winner.settings) {
                        const s = winner.settings;
                        engine.setVolume(1, s.volume?.gain ?? 1);
                        engine.setEq({
                          highpass: { frequency: s.eq.highpass.frequency, Q: audioCtx.state.eq.highpass.Q },
                          param1: { frequency: s.eq.param1.frequency, Q: s.eq.param1.Q, gain: s.eq.param1.gain },
                          param2: { frequency: s.eq.param2.frequency, Q: s.eq.param2.Q, gain: s.eq.param2.gain },
                          highshelf: { frequency: s.eq.highshelf.frequency, gain: s.eq.highshelf.gain }
                        } as any);
                      }
                      const { storage } = await import('../services/firebase');
                      const { ref, getDownloadURL } = await import('firebase/storage');
                      const path = winner.path;
                      const subUrl = path.startsWith('collabs/') ? await getDownloadURL(ref(storage, path)) : path;
                      const backingPath = currentCollaboration?.backingTrackPath || '';
                      const backUrl = backingPath ? (backingPath.startsWith('collabs/') ? await getDownloadURL(ref(storage, backingPath)) : backingPath) : '';
                      engine.playSubmission(subUrl, backUrl, 0);
                    }}
                    disabled={!winner?.path}
                  >play winner</button>
                </div>
              </div>
            </div>
          </section>
          <div className="submissions-scroll" style={{ overflowY: 'auto' }}>
            <div className="row gap-16 wrap">
              <CollabData collab={currentCollaboration as any} />
            </div>
          </div>
        </div>
      </div>
      {state && <Mixer state={state} />}
    </div>
  );
}

