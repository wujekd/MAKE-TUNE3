import { useContext, useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AudioEngineContext } from '../audio-services/AudioEngineContext';
import { useAppStore } from '../stores/appStore';
import './MainView.css';
import '../components/SubmissionItem.css';
import '../components/ProjectHistory.css';
import { Mixer } from '../components/Mixer';
import { CollabData } from '../components/CollabData';
import ProjectHistory from '../components/ProjectHistory';
import { CompletedCollaborationTimeline } from '../components/CompletedCollaborationTimeline';
import { AudioUrlUtils } from '../utils/audioUrlUtils';
import { LoadingSpinner } from '../components/LoadingSpinner';

export function CompletedView() {
  const { collaborationId } = useParams();
  const { user } = useAppStore(s => s.auth);
  const { currentCollaboration, currentProject, loadCollaboration, loadCollaborationAnonymousById } = useAppStore(s => s.collaboration);
  const audioCtx = useContext(AudioEngineContext);
  const engine = audioCtx?.engine;
  const navigate = useNavigate();
  const [isPlayingWinner, setIsPlayingWinner] = useState(false);
  const playInFlightRef = useRef(false);
  const winnerResolvedUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (!collaborationId) return;
    if (user) loadCollaboration(user.uid, collaborationId);
    else loadCollaborationAnonymousById(collaborationId);
  }, [collaborationId, user, loadCollaboration, loadCollaborationAnonymousById]);

  // Redirect if collaboration is in wrong stage
  useEffect(() => {
    if (!currentCollaboration || !collaborationId) return;
    
    const collabStatus = currentCollaboration.status;
    
    if (collabStatus === 'submission') {
      console.log('[CompletedView] Collaboration is in submission stage, redirecting...');
      navigate(`/collab/${collaborationId}/submit`, { replace: true });
    } else if (collabStatus === 'voting') {
      console.log('[CompletedView] Collaboration is in voting stage, redirecting...');
      navigate(`/collab/${collaborationId}`, { replace: true });
    }
  }, [currentCollaboration, collaborationId, navigate]);

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

  useEffect(() => {
    if (!winner?.path || !currentCollaboration?.backingTrackPath) return;
    
    Promise.all([
      AudioUrlUtils.resolveAudioUrl(winner.path),
      AudioUrlUtils.resolveAudioUrl(currentCollaboration.backingTrackPath)
    ]).then(() => {
      console.log('[CompletedView] Winner audio URLs prefetched');
    }).catch(err => {
      console.warn('[CompletedView] Failed to prefetch winner audio', err);
    });
  }, [winner?.path, currentCollaboration?.backingTrackPath]);

  const isWinnerPlaying = audioCtx?.state.player1.source === winnerResolvedUrlRef.current && winnerResolvedUrlRef.current !== null;
  const displayProgress = isWinnerPlaying && audioCtx?.state.player1.duration > 0
    ? (audioCtx.state.player1.currentTime / audioCtx.state.player1.duration) * 100
    : 0;

  const playWinner = useCallback(async () => {
    if (!engine || !winner?.path || !currentCollaboration?.backingTrackPath || playInFlightRef.current) return;
    
    if (isWinnerPlaying && audioCtx?.state.player1.isPlaying) {
      engine.pause();
      return;
    }
    
    playInFlightRef.current = true;
    setIsPlayingWinner(true);
    
    try {
      if (winner.settings) {
        const s = winner.settings;
        engine.setVolume(1, s.volume?.gain ?? 1);
        engine.setEq({
          highpass: { frequency: s.eq.highpass.frequency, Q: audioCtx?.state.eq.highpass.Q ?? 0.7 },
          param1: { frequency: s.eq.param1.frequency, Q: s.eq.param1.Q, gain: s.eq.param1.gain },
          param2: { frequency: s.eq.param2.frequency, Q: s.eq.param2.Q, gain: s.eq.param2.gain },
          highshelf: { frequency: s.eq.highshelf.frequency, gain: s.eq.highshelf.gain }
        } as any);
      }
      
      const subUrl = await AudioUrlUtils.resolveAudioUrl(winner.path);
      const backUrl = await AudioUrlUtils.resolveAudioUrl(currentCollaboration.backingTrackPath);
      
      winnerResolvedUrlRef.current = subUrl;
      
      engine.playSubmission(subUrl, backUrl, 0);
    } catch (err) {
      console.error('[CompletedView] Failed to play winner', err);
    } finally {
      setIsPlayingWinner(false);
      playInFlightRef.current = false;
    }
  }, [engine, winner, currentCollaboration?.backingTrackPath, audioCtx?.state, isWinnerPlaying]);

  useEffect(() => {
    if (isWinnerPlaying && audioCtx?.state.player1.isPlaying) {
      setIsPlayingWinner(false);
    }
  }, [isWinnerPlaying, audioCtx?.state.player1.isPlaying]);
  
  useEffect(() => {
    if (audioCtx?.state.player1.source !== winnerResolvedUrlRef.current && winnerResolvedUrlRef.current !== null) {
      winnerResolvedUrlRef.current = null;
    }
  }, [audioCtx?.state.player1.source]);

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
      <div className="info-top mv-fixed">
        <div className="mv-header-left">
          <div className="mv-header-col">
            <div className="mv-title">{currentProject?.name || ''}</div>
            <div className="mv-subtitle">project: {currentProject?.description || ''}</div>
          </div>
          <div className="mv-header-col">
            <div className="mv-title">{currentCollaboration?.name || ''}</div>
            <div className="mv-subtitle">collaboration: {currentCollaboration?.description || ''}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 16, alignItems: 'stretch', height: '100%', minHeight: 0 }}>
          <ProjectHistory />
          <div
            style={{
              backgroundColor: 'var(--primary1-600)',
              padding: '0.5rem',
              borderRadius: '0.5rem',
              boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.2)',
              minWidth: '400px',
              color: 'var(--white)',
              border: '3px solid transparent'
            }}
          >
            <div
              style={{
                backgroundColor: 'var(--primary1-700)',
                padding: '0.75rem',
                borderRadius: '0.25rem',
                boxShadow: 'inset 0 1px 3px rgba(0, 0, 0, 0.1)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem'
              }}
            >
              <CompletedCollaborationTimeline
                publishedAt={currentCollaboration?.publishedAt}
                submissionCloseAt={(currentCollaboration as any)?.submissionCloseAt}
                votingCloseAt={(currentCollaboration as any)?.votingCloseAt}
                progress={displayProgress}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="submissions-section active-playback">
        <div className="audio-player-section">
          <section className="favorites-section">
            <div className="favorites-header"><h2 className="favorites-title">Collaboration Results</h2></div>
            <div className="favorites-container" style={{ justifyContent: 'center' }}>
              <div 
                className={isWinnerPlaying && audioCtx?.state.player1.isPlaying ? 'currently-playing' : ''}
                style={{
                  backgroundColor: 'var(--primary1-600)',
                  padding: '0.5rem',
                  borderRadius: '0.5rem',
                  boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.2)',
                  border: '3px solid transparent',
                  minWidth: 280,
                  maxWidth: 400,
                  transition: 'all 0.2s ease'
                }}
              >
                <div
                  style={{
                    backgroundColor: 'var(--primary1-700)',
                    padding: '1rem',
                    borderRadius: '0.25rem',
                    boxShadow: 'inset 0 1px 3px rgba(0, 0, 0, 0.1)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem',
                    alignItems: 'center'
                  }}
                >
                  <div style={{ 
                    color: 'var(--white)', 
                    fontSize: '0.875rem', 
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    opacity: 0.9
                  }}>
                    Winner
                  </div>
                  <div style={{ 
                    color: 'var(--accent1)', 
                    fontSize: '1rem', 
                    fontWeight: 600,
                    textAlign: 'center'
                  }}>
                    {currentCollaboration?.winnerUserName || 'Anonymous'}
                  </div>
                  <button
                    onClick={playWinner}
                    disabled={!winner?.path}
                    className="play-button"
                    style={{ width: '100%', height: '48px', position: 'relative' }}
                  >
                    <div className="progress-bar" style={{ width: `${displayProgress}%` }}></div>
                    <span className="play-icon">
                      {isPlayingWinner ? (
                        <LoadingSpinner size={16} />
                      ) : (
                        isWinnerPlaying && audioCtx?.state.player1.isPlaying ? '❚❚' : '▶'
                      )}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </section>
          <div className="submissions-scroll" style={{ overflowY: 'auto', display: 'flex', justifyContent: 'center' }}>
            <div className="row gap-16 wrap" style={{ justifyContent: 'center' }}>
              <CollabData collab={currentCollaboration as any} />
            </div>
          </div>
        </div>
      </div>
      {state && <Mixer state={state} />}
    </div>
  );
}

