import { useContext, useEffect, useState } from "react";
import './SubmissionItem.css';
import { AudioEngineContext } from "../audio-services/AudioEngineContext";
import { useAppStore } from "../stores/appStore";
import type { Track } from "../types/collaboration";
import { LoadingSpinner } from "./LoadingSpinner";

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
  isVoting = false
}: SubmissionItemProps) {

  const { user } = useAppStore(state => state.auth);
  const audioContext = useContext(AudioEngineContext);
  const [pendingPlay, setPendingPlay] = useState(false);
  const engine = audioContext?.engine;
  const state = audioContext?.state;

  const displayProgress = isCurrentTrack && state && state.player1.duration > 0
    ? (state.player1.currentTime / state.player1.duration) * 100
    : 0;

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

  return (
    <div className={containerClass}>
      {statusLabel && (
        <div className="submission-status" aria-live="polite">
          <LoadingSpinner size={10} />
          <span>{statusLabel}</span>
        </div>
      )}
      <button
        className="play-button"
        onClick={handlePlayClick}
      >
        <div className="progress-bar" style={{ width: `${displayProgress}%` }}></div>
        <span className="play-icon">
          {pendingPlay ? <LoadingSpinner size={14} /> : (isCurrentTrack && isPlaying ? '❚❚' : '▶')}
        </span>
      </button>

      <div className="submission-actions">
        <button
          className={`like-button${liked ? ' liked' : ''}`}
          onClick={handleToggleLike}
          disabled={!user || isLikePending || isVotePending}
          aria-label={likeLabel}
          title={likeLabel}
        >
          {isLikePending ? <LoadingSpinner size={12} /> : '👍'}
        </button>

        {favorite ? (
          <button
            className="vote-button"
            onClick={() => voteFor(track.filePath)}
            disabled={isFinal || isVotePending || isFavoritePending}
          >
            {isVotePending && <LoadingSpinner size={12} />}
            {isFinal ? '✓ Voted' : (isVotePending ? 'Voting...' : 'Vote')}
          </button>
        ) : (
          <button
            className={`favorite-button${favorite ? ' favorited' : ''}`}
            onClick={handleAddToFavorites}
            disabled={!listened || !user || isFavoritePending || isVotePending}
            aria-label={favoriteIconLabel}
            title={favoriteLabel}
          >
            {pendingFavoriteAction === 'adding' ? <LoadingSpinner size={12} /> : '♥'}
          </button>
        )}
      </div>
    </div>
  );
}
