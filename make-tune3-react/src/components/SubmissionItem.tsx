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
  isFinal
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

  const containerClass = [
    'submission-container',
    isFinal ? 'voted-for' : '',
    listened ? 'listened' : '',
    isCurrentTrack ? 'currently-playing' : ''
  ].filter(Boolean).join(' ');

  return (
    <div className={containerClass}>
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
          disabled={isFinal}
        >
          {isFinal ? '✓ Voted' : 'Vote'}
        </button>
      ) : (
        <button
          className="favorite-button"
          onClick={handleAddToFavorites}
          disabled={!listened || !user}
        >
          {!user ? 'Login to add' : (listened ? 'Add to favorites' : `Listen to ${listenedRatio}% to add`)}
        </button>
      )}
    </div>
  );
}
