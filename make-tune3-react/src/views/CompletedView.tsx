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
import { useCollaborationLoader } from '../hooks/useCollaborationLoader';
import { useStageRedirect } from '../hooks/useStageRedirect';
import { WinnerCard } from '../components/WinnerCard';
import styles from './CompletedView.module.css';

export function CompletedView() {
  const { collaborationId } = useParams();
  const { user } = useAppStore(s => s.auth);
  const { currentCollaboration, currentProject } = useAppStore(s => s.collaboration);
  const audioCtx = useContext(AudioEngineContext);
  const engine = audioCtx?.engine;
  const navigate = useNavigate();
  const [isPlayingWinner, setIsPlayingWinner] = useState(false);
  const playInFlightRef = useRef(false);
  const winnerResolvedUrlRef = useRef<string | null>(null);

  useCollaborationLoader(collaborationId);
  useStageRedirect({
    expected: 'completed',
    collaboration: currentCollaboration,
    collabId: collaborationId,
    navigate
  });

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

  if (!audioCtx || !audioCtx.state) return <div className={styles.loading}>Audio engine not available</div>;
  const state = audioCtx.state;

  const winnerCardWrapperClass = [
    styles.winnerCardWrapper,
    isWinnerPlaying && audioCtx?.state.player1.isPlaying ? styles.playing : ''
  ].filter(Boolean).join(' ');

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.headerCol}>
            <div className={styles.title}>{currentProject?.name || ''}</div>
            <div className={styles.subtitle}>{currentProject?.description || ''}</div>
          </div>
          <div className={styles.headerCol}>
            <div className={styles.title}>{currentCollaboration?.name || ''}</div>
            <div className={styles.subtitle}>{currentCollaboration?.description || ''}</div>
          </div>
        </div>
        <div className={styles.headerRight}>
          <ProjectHistory />
          <div className="card collab-timeline">
            <div className="collab-timeline__inner">
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

      <div className={styles.content}>
        <div className={styles.resultsSection}>
          <div className={styles.winnerSection}>
            <h2 className={styles.sectionTitle}>Collaboration Results</h2>
            <div className={winnerCardWrapperClass}>
              <WinnerCard
                name={currentCollaboration?.winnerUserName || 'Anonymous'}
                progressPercent={displayProgress}
                isPlaying={isWinnerPlaying && audioCtx?.state.player1.isPlaying}
                isLoading={isPlayingWinner}
                disabled={!winner?.path}
                onPlay={playWinner}
              />
            </div>
          </div>
          <div className={styles.collabDataSection}>
            <CollabData collab={currentCollaboration as any} />
          </div>
        </div>

        <div className={styles.mixerSection}>
          {state && <Mixer state={state} />}
        </div>
      </div>
    </div>
  );
}
