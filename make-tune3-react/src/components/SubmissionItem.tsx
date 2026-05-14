import { useContext, useEffect, useMemo, useState } from "react";
import './SubmissionItem.css';
import { AudioEngineContext } from "../audio-services/AudioEngineContext";
import { useAppStore } from "../stores/appStore";
import type { Track } from "../types/collaboration";
import { LoadingSpinner } from "./LoadingSpinner";
import { useWaveformData } from "../hooks/useWaveformData";
import { WaveformStrip } from "./WaveformStrip";

interface SubmissionItemProps {
  track: Track;
  index: number;
  isPlaying: boolean;
  isCurrentTrack: boolean;
  listened: boolean;
  liked: boolean;
  favorite: boolean;
  onToggleLike: (trackId: string) => void;
  onAddToFavorites: (trackId: string) => void;
  onPlay: (trackId: string, index: number, favorite: boolean) => void;
  voteFor: (trackId: string) => void;
  listenedRatio: number;
  isFinal: boolean;
  pendingFavoriteAction?: 'adding' | 'removing' | null;
  pendingLikeAction?: 'adding' | 'removing' | null;
  isVoting?: boolean;
  votingDisabled?: boolean;
  animationDelayMs?: number;
}

export default function SubmissionItem({
  track,
  index,
  isPlaying,
  isCurrentTrack,
  listened,
  liked,
  favorite,
  onToggleLike,
  onAddToFavorites,
  onPlay,
  voteFor,
  listenedRatio,
  isFinal,
  pendingFavoriteAction = null,
  pendingLikeAction = null,
  isVoting = false,
  votingDisabled = false,
  animationDelayMs
}: SubmissionItemProps) {

  const user = useAppStore(state => state.auth.user);
  const audioContext = useContext(AudioEngineContext);
  const [pendingPlay, setPendingPlay] = useState(false);
  const engine = audioContext?.engine;
  const state = audioContext?.state;

  const displayProgress = isCurrentTrack && state && state.player1.duration > 0
    ? (state.player1.currentTime / state.player1.duration) * 100
    : 0;
  const waveformMeta = useMemo(() => ({
    path: track.waveformPath ?? null,
    status: track.waveformStatus ?? (track.waveformPath ? 'ready' : null),
    bucketCount: track.waveformBucketCount ?? null,
    version: track.waveformVersion ?? null,
    error: track.waveformError ?? null
  }), [
    track.waveformBucketCount,
    track.waveformError,
    track.waveformPath,
    track.waveformStatus,
    track.waveformVersion
  ]);
  const { data: waveformData, uiState: waveformUiState } = useWaveformData({
    initialMeta: waveformMeta,
    initialData: track.waveformPreview ?? null,
    enabled: Boolean(track.waveformPath || track.waveformPreview),
    deferLoad: Boolean(track.waveformPreview)
  });

  const handlePlayClick = () => {
    if (!engine) return;
    if (isPlaying && isCurrentTrack) {
      engine.pause();
      setPendingPlay(false);
    } else {
      setPendingPlay(true);
      onPlay(track.filePath, index, favorite)
    }
  };

  const seekSubmissionWhenReady = (ratio: number) => {
    if (!engine) return;
    const clampedRatio = Math.max(0, Math.min(1, ratio));
    let attempts = 0;

    const trySeek = () => {
      attempts += 1;
      const nextState = engine.getState();
      const nextDuration = nextState.player1.duration || 0;
      const isExpectedTrack = nextState.playerController.currentTrackId === index;
      const isExpectedList = nextState.playerController.playingFavourite === favorite;

      if (nextDuration > 0 && isExpectedTrack && isExpectedList) {
        engine.seek(nextDuration * clampedRatio);
        return;
      }

      if (attempts < 20) {
        window.setTimeout(trySeek, 80);
      }
    };

    window.setTimeout(trySeek, 0);
  };

  const handleWaveformSeek = (ratio: number) => {
    if (!engine) return;
    const clampedRatio = Math.max(0, Math.min(1, ratio));

    if (isCurrentTrack && duration > 0) {
      engine.seek(duration * clampedRatio);
      return;
    }

    setPendingPlay(true);
    onPlay(track.filePath, index, favorite);
    seekSubmissionWhenReady(clampedRatio);
  };

  useEffect(() => {
    if (isCurrentTrack && isPlaying) {
      setPendingPlay(false);
    }
  }, [isCurrentTrack, isPlaying]);

  const handleAddToFavorites = () => {
    onAddToFavorites(track.filePath);
  };
  const handleToggleLike = () => {
    onToggleLike(track.filePath);
  };

  const isFavoritePending = pendingFavoriteAction === 'adding' || pendingFavoriteAction === 'removing';
  const isLikePending = pendingLikeAction === 'adding' || pendingLikeAction === 'removing';
  const isVotePending = isVoting;
  const isBusy = isFavoritePending || isLikePending || isVotePending;
  const statusLabel = isVotePending ? 'Voting...' : null;
  const waveformState = waveformUiState === 'ready'
    ? 'ready'
    : 'placeholder';
  const currentTime = isCurrentTrack ? (state?.player1.currentTime ?? 0) : 0;
  const duration = isCurrentTrack ? (state?.player1.duration ?? 0) : 0;

  if (!audioContext || !state) {
    return <div>Loading audio engine...</div>;
  }

  const containerClass = [
    'submission-container',
    isFinal ? 'voted-for' : '',
    listened ? 'listened' : '',
    isCurrentTrack ? 'currently-playing' : '',
    isBusy ? 'pending-action' : ''
  ].filter(Boolean).join(' ');

  const favoriteLabel = !user
    ? 'Login to add'
    : (listened ? 'Add to favorites' : `Listen to ${listenedRatio}% to add`);
  const likeLabel = !user ? 'Like' : (liked ? 'Liked' : 'Like');
  const favoriteIconLabel = favorite ? 'Favorited track' : favoriteLabel;
  const primaryActionContent = favorite
    ? (isVotePending ? <LoadingSpinner size={12} /> : (isFinal ? '✓' : '★'))
    : (pendingFavoriteAction === 'adding' ? <LoadingSpinner size={12} /> : '★');

  return (
    <div className={containerClass}>
      {statusLabel && (
        <div className="submission-status" aria-live="polite">
          <LoadingSpinner size={10} />
          <span>{statusLabel}</span>
        </div>
      )}
      <button
        className="submission-main-button"
        onClick={handlePlayClick}
        aria-label={isCurrentTrack && isPlaying ? 'Pause submission' : 'Play submission'}
      >
        <div className="submission-progress-overlay" style={{ width: `${displayProgress}%` }} />
        <div className="submission-waveform">
          <WaveformStrip
            data={waveformData}
            state={waveformState}
            animationDelayMs={animationDelayMs ?? Math.min(index, 10) * 160}
            progress={displayProgress / 100}
            currentTime={currentTime}
            duration={duration}
            isPlaying={isCurrentTrack && isPlaying}
            isInteractive={Boolean(engine && waveformUiState === 'ready')}
            onSeek={handleWaveformSeek}
          />
        </div>
        <div className="submission-button-scrim" aria-hidden="true" />
        <div className="submission-card-glow" aria-hidden="true" />
        <div className="submission-main-content">
          <span className="play-icon">
            {pendingPlay ? <LoadingSpinner size={16} /> : (isCurrentTrack && isPlaying ? '❚❚' : '▶')}
          </span>
        </div>
      </button>

      <div className="submission-actions submission-actions--centered">
        <button
          className={`submission-primary-action ${favorite ? 'submission-primary-action--vote' : 'submission-primary-action--favorite'}`}
          onClick={favorite ? () => voteFor(track.filePath) : handleAddToFavorites}
          disabled={favorite ? (votingDisabled || isFinal || isVotePending || isFavoritePending) : (!listened || !user || isFavoritePending || isVotePending)}
          aria-label={favorite ? (isFinal ? 'Voted' : 'Vote') : favoriteIconLabel}
          title={favorite ? (isFinal ? 'Voted' : 'Vote for this favorite') : favoriteLabel}
        >
          <span className="submission-primary-action__inner" aria-hidden="true">
            {primaryActionContent}
          </span>
        </button>
      </div>

      {!favorite && !isFinal && (
        <button
          className={`like-button like-button--rear${liked ? ' liked' : ''}`}
          onClick={handleToggleLike}
          disabled={!user || isLikePending || isVotePending}
          aria-label={likeLabel}
          title={likeLabel}
        >
          {isLikePending ? <LoadingSpinner size={12} /> : (
            <span className="like-button__label" aria-hidden="true">nice</span>
          )}
        </button>
      )}
    </div>
  );
}
