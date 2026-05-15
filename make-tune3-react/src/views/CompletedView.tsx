import { useContext, useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AudioEngineContext } from '../audio-services/AudioEngineContext';
import { useAppStore } from '../stores/appStore';
import './MainView.css';
import '../components/SubmissionItem.css';
import '../components/ProjectHistory.css';
import { Mixer } from '../components/Mixer';
import ProjectHistory from '../components/ProjectHistory';
import { CompletedCollaborationTimeline } from '../components/CompletedCollaborationTimeline';
import { AudioUrlUtils } from '../utils/audioUrlUtils';
import { useCollaborationLoader } from '../hooks/useCollaborationLoader';
import { useWaveformData } from '../hooks/useWaveformData';
import { useStageRedirect } from '../hooks/useStageRedirect';
import { WaveformStrip } from '../components/WaveformStrip';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { MissingCollaborationState } from '../components/MissingCollaborationState';
import { CollaborationPreferenceBar } from '../components/CollaborationPreferenceBar';
import type { WaveformRenderData } from '../types/waveform';
import styles from './CompletedView.module.css';

const compactCountFormatter = new Intl.NumberFormat('en', {
  notation: 'compact',
  maximumFractionDigits: 1
});

const standardCountFormatter = new Intl.NumberFormat('en');

const formatCount = (value: number) => {
  if (!Number.isFinite(value)) return '0';
  if (Math.abs(value) >= 10000) return compactCountFormatter.format(value);
  return standardCountFormatter.format(value);
};

const clipWaveformToRatio = (
  data: WaveformRenderData | null,
  ratio: number
): WaveformRenderData | null => {
  if (!data || ratio >= 1) {
    return data;
  }

  const clippedRatio = Math.max(0, Math.min(1, ratio));
  const bucketCount = Math.max(1, Math.round(data.peaks.max.length * clippedRatio));

  return {
    ...data,
    bucketCount,
    peaks: {
      min: data.peaks.min.slice(0, bucketCount),
      max: data.peaks.max.slice(0, bucketCount)
    }
  };
};

const getDurationClipRatio = (sourceDuration: number, targetDuration: number): number => {
  if (sourceDuration <= 0 || targetDuration <= 0 || targetDuration >= sourceDuration) {
    return 1;
  }

  return Math.max(0, Math.min(1, targetDuration / sourceDuration));
};

const getWaveformDuration = (data: WaveformRenderData | null): number => {
  const duration = (data as { duration?: unknown } | null)?.duration;
  return typeof duration === 'number' && Number.isFinite(duration) ? duration : 0;
};

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
  const backingResolvedUrlRef = useRef<string | null>(null);
  const heroPlayProgressRef = useRef<HTMLSpanElement | null>(null);
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
    return { path, entry, settings: entry?.settings };
  }, [requestedCollaboration]);

  const backingWaveformMeta = useMemo(() => ({
    path: requestedCollaboration?.backingWaveformPath ?? null,
    status: requestedCollaboration?.backingWaveformStatus ?? (requestedCollaboration?.backingTrackPath ? 'pending' : null),
    bucketCount: requestedCollaboration?.backingWaveformBucketCount ?? null,
    version: requestedCollaboration?.backingWaveformVersion ?? null,
    error: requestedCollaboration?.backingWaveformError ?? null
  }), [
    requestedCollaboration?.backingTrackPath,
    requestedCollaboration?.backingWaveformBucketCount,
    requestedCollaboration?.backingWaveformError,
    requestedCollaboration?.backingWaveformPath,
    requestedCollaboration?.backingWaveformStatus,
    requestedCollaboration?.backingWaveformVersion
  ]);

  const winnerWaveformMeta = useMemo(() => ({
    path: winner?.entry?.waveformPath ?? null,
    status: winner?.entry?.waveformStatus ?? (winner?.entry?.waveformPath ? 'ready' : null),
    bucketCount: winner?.entry?.waveformBucketCount ?? null,
    version: winner?.entry?.waveformVersion ?? null,
    error: winner?.entry?.waveformError ?? null
  }), [
    winner?.entry?.waveformBucketCount,
    winner?.entry?.waveformError,
    winner?.entry?.waveformPath,
    winner?.entry?.waveformStatus,
    winner?.entry?.waveformVersion
  ]);

  const { data: backingWaveformData, uiState: backingWaveformUiState } = useWaveformData({
    initialMeta: backingWaveformMeta,
    initialData: requestedCollaboration?.backingWaveformPreview ?? null,
    enabled: Boolean(requestedCollaboration?.backingTrackPath || requestedCollaboration?.backingWaveformPreview),
    deferLoad: false
  });

  const { data: winnerWaveformData, uiState: winnerWaveformUiState } = useWaveformData({
    initialMeta: winnerWaveformMeta,
    initialData: winner?.entry?.waveformPreview ?? null,
    enabled: Boolean(winner?.entry?.waveformPath || winner?.entry?.waveformPreview),
    deferLoad: false
  });

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

  useEffect(() => {
    const node = heroPlayProgressRef.current;
    const player = audioCtx?.state.player1;
    if (!node || !player) return;

    const duration = Math.max(0, player.duration || 0);
    const baseTime = Math.max(0, player.currentTime || 0);
    const startedAt = typeof performance !== 'undefined' ? performance.now() : 0;
    const isActiveWinner = isWinnerPlaying && duration > 0;
    let frame = 0;

    const setProgress = (ratio: number) => {
      node.style.transform = `scaleX(${Math.max(0, Math.min(1, ratio))})`;
    };

    if (!isActiveWinner) {
      setProgress(0);
      return;
    }

    const tick = () => {
      const now = typeof performance !== 'undefined' ? performance.now() : 0;
      const elapsed = audioCtx.state.player1.isPlaying ? (now - startedAt) / 1000 : 0;
      setProgress((baseTime + elapsed) / duration);
      frame = window.requestAnimationFrame(tick);
    };

    tick();

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [
    audioCtx?.state.player1.currentTime,
    audioCtx?.state.player1.duration,
    audioCtx?.state.player1.isPlaying,
    isWinnerPlaying
  ]);

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
      backingResolvedUrlRef.current = backUrl;
      engine.playStandaloneSubmission(subUrl, backUrl);
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

  useEffect(() => {
    if (audioCtx?.state.player2.source !== backingResolvedUrlRef.current && backingResolvedUrlRef.current !== null) {
      backingResolvedUrlRef.current = null;
    }
  }, [audioCtx?.state.player2.source]);

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
  const heroPlayClass = [
    styles.heroPlayButton,
    isWinnerPlaying && audioCtx?.state.player1.isPlaying ? styles.playing : ''
  ].filter(Boolean).join(' ');
  const winnerWaveformState = winnerWaveformUiState === 'ready' ? 'ready' : 'placeholder';
  const isBackingPlaying = backingResolvedUrlRef.current !== null
    && audioCtx.state.player2.source === backingResolvedUrlRef.current
    && audioCtx.state.player2.isPlaying;
  const winnerProgressRatio = displayProgress / 100;
  const backingWaveformDuration = getWaveformDuration(backingWaveformData);
  const winnerWaveformDuration = getWaveformDuration(winnerWaveformData);
  const backingClipRatio = getDurationClipRatio(
    backingWaveformDuration,
    winnerWaveformDuration
  );
  const clippedBackingWaveformData = clipWaveformToRatio(backingWaveformData, backingClipRatio);
  const clippedBackingWaveformPreview = clipWaveformToRatio(
    requestedCollaboration.backingWaveformPreview ?? null,
    backingClipRatio
  );
  const displayedBackingWaveformData = backingWaveformDuration > 0 && winnerWaveformDuration > 0
    ? clippedBackingWaveformData
    : null;
  const displayedBackingWaveformState = displayedBackingWaveformData
    ? 'ready'
    : backingWaveformUiState === 'loading' || winnerWaveformUiState === 'loading'
      ? 'loading'
      : 'placeholder';
  const winnerWaveformPreview = winner?.entry?.waveformPreview ?? null;
  const submissionsArr = Array.isArray(requestedCollaboration.submissions)
    ? requestedCollaboration.submissions
    : [];
  const results = Array.isArray((requestedCollaboration as any).results)
    ? [...((requestedCollaboration as any).results as Array<{ path: string; votes: number }>)]
        .sort((a, b) => (b?.votes || 0) - (a?.votes || 0))
    : [];
  const submissionsCount = typeof requestedCollaboration.submissionsCount === 'number'
    ? requestedCollaboration.submissionsCount
    : submissionsArr.length;
  const participantsCount = Array.isArray(requestedCollaboration.participantIds)
    ? requestedCollaboration.participantIds.length
    : Math.max(submissionsCount, 0);
  const favoritesCount = requestedCollaboration.favoritesCount || 0;
  const resultVotesTotal = results.reduce((sum, result) => sum + (result?.votes || 0), 0);
  const totalVotes = typeof requestedCollaboration.totalVotes === 'number'
    ? requestedCollaboration.totalVotes
    : (resultVotesTotal || requestedCollaboration.votesCount || 0);
  const winnerVotes = typeof requestedCollaboration.winnerVotes === 'number'
    ? requestedCollaboration.winnerVotes
    : (results[0]?.votes || 0);
  const winnerShare = totalVotes > 0 ? Math.round((winnerVotes / totalVotes) * 100) : 0;
  const winnerName = requestedCollaboration.winnerUserName || 'Anonymous';
  const stats = [
    { label: 'participants', value: participantsCount },
    { label: 'submissions', value: submissionsCount },
    { label: 'favorites', value: favoritesCount },
    { label: 'votes cast', value: totalVotes }
  ];

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
          </div>
        </div>
        <div className={styles.preferenceSlot}>
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
          <div className={`${styles.waveformBackdrop} ${styles.waveformBackdropTop}`} aria-hidden="true">
            <WaveformStrip
              data={displayedBackingWaveformData}
              state={displayedBackingWaveformState}
              initialUnderlayData={clippedBackingWaveformPreview}
              initialCascadeProgress={1}
              repeatCascadeProgress={0}
              progress={winnerProgressRatio}
              currentTime={audioCtx.state.player1.currentTime}
              duration={audioCtx.state.player1.duration}
              isPlaying={isBackingPlaying}
              underlayAlpha={0.68}
              waveformAlpha={1.2}
            />
          </div>
          <div className={`${styles.waveformBackdrop} ${styles.waveformBackdropBottom}`} aria-hidden="true">
            <WaveformStrip
              data={winnerWaveformData}
              state={winnerWaveformState}
              initialUnderlayData={winnerWaveformPreview}
              initialCascadeProgress={1}
              repeatCascadeProgress={0}
              progress={winnerProgressRatio}
              currentTime={audioCtx.state.player1.currentTime}
              duration={audioCtx.state.player1.duration}
              isPlaying={isWinnerPlaying && audioCtx.state.player1.isPlaying}
              underlayAlpha={0.68}
              waveformAlpha={1.2}
            />
          </div>
          <div className={styles.resultsChrome}>
            <div className={styles.stageKicker}>Collaboration Results</div>

            <section className={styles.hero} aria-label="Winning submission">
              <div className={styles.heroCopy}>
                <div className={styles.heroEyebrow}>Winner</div>
                <h2 className={styles.heroTitle}>{winnerName}</h2>
              </div>

              <div className={styles.heroMeta}>
                <span>{formatCount(winnerVotes)} winner votes</span>
                <span>{winnerShare}% vote share</span>
              </div>

              <button
                onClick={playWinner}
                disabled={!winner?.path}
                className={heroPlayClass}
                type="button"
                aria-label={isWinnerPlaying && audioCtx.state.player1.isPlaying ? 'Pause winning submission' : 'Play winning submission'}
              >
                <span
                  ref={heroPlayProgressRef}
                  className={styles.heroPlayProgress}
                  aria-hidden="true"
                />
                <span className={styles.heroPlayIcon} aria-hidden="true">
                  {isPlayingWinner ? <LoadingSpinner size={16} /> : isWinnerPlaying && audioCtx.state.player1.isPlaying ? '❚❚' : '▶'}
                </span>
                <span className={styles.heroPlayText}>
                  {isWinnerPlaying && audioCtx.state.player1.isPlaying ? 'Playing winner' : 'Play winner'}
                </span>
              </button>
            </section>

            <section className={styles.resultDetails} aria-label="Result details">
              <div className={styles.metricGrid}>
                {stats.map(stat => (
                  <div className={styles.metricTile} key={stat.label}>
                    <div className={styles.metricValue}>{formatCount(stat.value)}</div>
                    <div className={styles.metricLabel}>{stat.label}</div>
                  </div>
                ))}
              </div>

              <div className={styles.votePanel}>
                <div className={styles.votePanelHeader}>
                  <span>Vote ranking</span>
                  <span>{totalVotes > 0 ? `${formatCount(totalVotes)} total` : 'no votes'}</span>
                </div>
                {results.length > 0 ? (
                  <div className={styles.voteRows}>
                    {results.slice(0, 5).map((result, index) => {
                      const percent = totalVotes > 0 ? Math.round(((result?.votes || 0) / totalVotes) * 100) : 0;
                      return (
                        <div className={styles.voteRow} key={result.path || index}>
                          <span className={styles.voteRank}>#{index + 1}</span>
                          <span className={styles.voteBar} aria-hidden="true">
                            <span style={{ width: `${percent}%` }} />
                          </span>
                          <span className={styles.voteCount}>{formatCount(result?.votes || 0)}</span>
                          <span className={styles.votePercent}>{percent}%</span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className={styles.emptyResults}>No ranked vote data yet.</div>
                )}
              </div>
            </section>
          </div>
        </div>

        <div className={`mixer-theme ${styles.mixerSection}`}>
          {state && <Mixer state={state} />}
        </div>
      </div>
    </div>
  );
}
