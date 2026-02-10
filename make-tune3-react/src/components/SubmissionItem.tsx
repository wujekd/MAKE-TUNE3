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
  favorite: boolean;
  onAddToFavorites: (trackId: string) => void;
  onPlay: (trackId: string, index: number, favorite: boolean) => void;
  voteFor: (trackId: string) => void;
  listenedRatio: number;
  isFinal: boolean;
  pendingFavoriteAction?: 'adding' | 'removing' | null;
  isVoting?: boolean;
}

export default function SubmissionItem({
  track,
  index,
  isPlaying,
  isCurrentTrack,
  listened,
  favorite,
  onAddToFavorites,
  onPlay,
  voteFor,
  listenedRatio,
  isFinal,
  pendingFavoriteAction = null,
  isVoting = false
}: SubmissionItemProps) {

  const { user } = useAppStore(state => state.auth);
  const audioContext = useContext(AudioEngineContext);
  if (!audioContext) {
    return <div>Loading audio engine...</div>;
  }
  const { engine, state } = audioContext;
  const [pendingPlay, setPendingPlay] = useState(false);

  const displayProgress = isCurrentTrack && state.player1.duration > 0
    ? (state.player1.currentTime / state.player1.duration) * 100
    : 0;

  const handlePlayClick = () => {
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

  const isFavoritePending = pendingFavoriteAction === 'adding' || pendingFavoriteAction === 'removing';
  const isVotePending = isVoting;
  const isBusy = isFavoritePending || isVotePending;
  const statusLabel = isVotePending ? 'Voting...' : null;

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
          className="favorite-button"
          onClick={handleAddToFavorites}
          disabled={!listened || !user || isFavoritePending || isVotePending}
        >
          {pendingFavoriteAction === 'adding' && <LoadingSpinner size={12} />}
          {favoriteLabel}
        </button>
      )}
    </div>
  );
}
