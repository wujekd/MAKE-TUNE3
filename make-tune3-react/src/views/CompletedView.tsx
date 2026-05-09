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
import { LoadingSpinner } from '../components/LoadingSpinner';
import { MissingCollaborationState } from '../components/MissingCollaborationState';
import { CollaborationPreferenceBar } from '../components/CollaborationPreferenceBar';
import styles from './CompletedView.module.css';

export function CompletedView() {
  const { collabId } = useParams();
  const collaborationId = collabId;
  const user = useAppStore(s => s.auth.user);
  const currentCollaboration = useAppStore(s => s.collaboration.currentCollaboration);
  const currentProject = useAppStore(s => s.collaboration.currentProject);
  const userCollaboration = useAppStore(s => s.collaboration.userCollaboration);
  const likeCollaboration = useAppStore(s => s.collaboration.likeCollaboration);
  const unlikeCollaboration = useAppStore(s => s.collaboration.unlikeCollaboration);
  const favoriteCollaboration = useAppStore(s => s.collaboration.favoriteCollaboration);
  const unfavoriteCollaboration = useAppStore(s => s.collaboration.unfavoriteCollaboration);
  const isUpdatingCollaborationLike = useAppStore(s => s.collaboration.isUpdatingCollaborationLike);
  const isUpdatingCollaborationFavorite = useAppStore(s => s.collaboration.isUpdatingCollaborationFavorite);
  const audioCtx = useContext(AudioEngineContext);
  const engine = audioCtx?.engine;
  const navigate = useNavigate();
  const [isPlayingWinner, setIsPlayingWinner] = useState(false);
  const playInFlightRef = useRef(false);
  const winnerResolvedUrlRef = useRef<string | null>(null);
  const loader = useCollaborationLoader(collaborationId);
  const requestedCollaboration = currentCollaboration?.id === collaborationId ? currentCollaboration : null;
  const requestedProject =
    requestedCollaboration && currentProject?.id === requestedCollaboration.projectId
      ? currentProject
      : null;

  useStageRedirect({
    expected: 'completed',
    collaboration: requestedCollaboration,
    collabId: collaborationId,
    navigate
  });

  useEffect(() => {
    if (!engine) return;
    engine.setPlaybackTrackingEnabled(false);
    return () => { engine.setPlaybackTrackingEnabled(true); };
  }, [engine]);

  const winner = useMemo(() => {
    if (!requestedCollaboration?.winnerPath) return null;
    const path = requestedCollaboration.winnerPath;
    const entry = requestedCollaboration.submissions?.find(s => s.path === path);
    return { path, settings: entry?.settings };
  }, [requestedCollaboration]);

  useEffect(() => {
    if (!winner?.path || !requestedCollaboration?.backingTrackPath) return;

    Promise.all([
      AudioUrlUtils.resolveAudioUrl(winner.path),
      AudioUrlUtils.resolveAudioUrl(requestedCollaboration.backingTrackPath)
    ]).then(() => {
      if (import.meta.env.DEV) console.log('[CompletedView] Winner audio URLs prefetched');
    }).catch(err => {
      console.warn('[CompletedView] Failed to prefetch winner audio', err);
    });
  }, [winner?.path, requestedCollaboration?.backingTrackPath]);

  const isWinnerPlaying = audioCtx?.state.player1.source === winnerResolvedUrlRef.current && winnerResolvedUrlRef.current !== null;
  const displayProgress = isWinnerPlaying && audioCtx?.state.player1.duration > 0
    ? (audioCtx.state.player1.currentTime / audioCtx.state.player1.duration) * 100
    : 0;

  const playWinner = useCallback(async () => {
    if (!engine || !winner?.path || !requestedCollaboration?.backingTrackPath || playInFlightRef.current) return;

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
      const backUrl = await AudioUrlUtils.resolveAudioUrl(requestedCollaboration.backingTrackPath);

      winnerResolvedUrlRef.current = subUrl;
      engine.playSubmission(subUrl, backUrl, 0);
    } catch (err) {
      console.error('[CompletedView] Failed to play winner', err);
    } finally {
      setIsPlayingWinner(false);
      playInFlightRef.current = false;
    }
  }, [engine, winner, requestedCollaboration?.backingTrackPath, audioCtx?.state, isWinnerPlaying]);

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

  if (loader.status === 'not_found') {
    return <MissingCollaborationState collaborationId={collaborationId} viewLabel="completed view" />;
  }

  if (!audioCtx || !audioCtx.state) return <div className={styles.loading}>Audio engine not available</div>;

  if (loader.status === 'loading' || !requestedCollaboration) {
    return (
      <div className={styles.loading}>
        <div className={styles.loadingStack}>
          <LoadingSpinner size={32} />
          <div>Loading completed view…</div>
        </div>
      </div>
    );
  }

  const state = audioCtx.state;
  const winnerCardWrapperClass = [
    styles.winnerCardWrapper,
    isWinnerPlaying && audioCtx?.state.player1.isPlaying ? styles.playing : ''
  ].filter(Boolean).join(' ');

  return (
    <div className={`view-container ${styles.container}`}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.headerCol}>
            <div className={styles.title}>{requestedProject?.name || ''}</div>
            <div className={styles.subtitle}>{requestedProject?.description || ''}</div>
          </div>
          <div className={styles.headerCol}>
            <div className={styles.title}>{requestedCollaboration?.name || ''}</div>
            <div className={styles.subtitle}>{requestedCollaboration?.description || ''}</div>
            <CollaborationPreferenceBar
              disabled={!user}
              liked={Boolean(userCollaboration?.likedCollaboration)}
              favorited={Boolean(userCollaboration?.favoritedCollaboration)}
              isUpdatingLike={isUpdatingCollaborationLike}
              isUpdatingFavorite={isUpdatingCollaborationFavorite}
              onToggleLike={() => {
                if (userCollaboration?.likedCollaboration) {
                  unlikeCollaboration();
                } else {
                  likeCollaboration();
                }
              }}
              onToggleFavorite={() => {
                if (userCollaboration?.favoritedCollaboration) {
                  unfavoriteCollaboration();
                } else {
                  favoriteCollaboration();
                }
              }}
            />
          </div>
        </div>
        <div className={styles.headerRight}>
          <ProjectHistory />
          <div className="card collab-timeline">
            <div className="collab-timeline__inner">
              <CompletedCollaborationTimeline
                publishedAt={requestedCollaboration?.publishedAt}
                submissionCloseAt={(requestedCollaboration as any)?.submissionCloseAt}
                votingCloseAt={(requestedCollaboration as any)?.votingCloseAt}
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
                name={requestedCollaboration?.winnerUserName || 'Anonymous'}
                progressPercent={displayProgress}
                isPlaying={isWinnerPlaying && audioCtx?.state.player1.isPlaying}
                isLoading={isPlayingWinner}
                disabled={!winner?.path}
                onPlay={playWinner}
              />
            </div>
          </div>
          <div className={styles.collabDataSection}>
            <CollabData collab={requestedCollaboration as any} />
          </div>
        </div>

        <div className={`mixer-theme ${styles.mixerSection}`}>
          {state && <Mixer state={state} />}
        </div>
      </div>
    </div>
  );
}
