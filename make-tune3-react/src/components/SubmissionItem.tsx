import React, { useContext } from "react";
import './SubmissionItem.css';
import { AudioEngineContext } from "../audio-services/AudioEngineContext";
import type { Track } from "../types/collaboration";

export default ({ track, index, isPlaying, isCurrentTrack, listened, favorite, onAddToFavorites, onPlay, voteFor, listenedRatio, isFinal}:
    { track: Track, index: number, isPlaying: boolean, isCurrentTrack: boolean,
      listened: boolean,
      favorite: boolean,
      onAddToFavorites: (trackId: string) => void,
      onPlay: (trackId: string, index: number, favorite: boolean ) => void,
      voteFor: (trackId: string) => void,
      listenedRatio: number,
      isFinal: boolean
    }) => {

  const submission = {
    markingListened: false,
    collabId: 'temp-collab'
  };

  const audioContext = useContext(AudioEngineContext);
  if (!audioContext) {
    return <div>Loading audio engine...</div>;
  }
  const { engine, state } = audioContext;
  
  const isVotedFor = false;
  const isSubmittingVote = false;

  const displayProgress = isCurrentTrack && state.player1.duration > 0 
    ? (state.player1.currentTime / state.player1.duration) * 100 
    : 0;
  
  const handlePlayClick = () => {
    console.log('playSubmission called with:', track.id, index, favorite)
    if (isPlaying && isCurrentTrack){
      engine.pause();
    } else {
      onPlay(track.id, index, favorite)
    }
  };
  
  const onVote = (sub: any) => {
    voteFor(track.id);
  };
  
  const handleAddToFavorites = () => {
    console.log('Add to favorites clicked for track:', track.id);
    onAddToFavorites(track.id);
  };

  return (
    <div className={`
      submission-container
      ${isFinal ? 'voted-for' : ''}
      ${submission.markingListened ? 'marking' : ''}
      ${listened ? 'listened' : ''}
    `}>
      <div style={{ fontSize: '10px', color: 'white', marginBottom: '4px' }}>
        Index: {index} | Track: {track.title}
      </div>
      <button 
        className="play-button" 
        onClick={handlePlayClick}
      >
        <div className="progress-bar" style={{ width: `${displayProgress}%` }}></div>
        <span className="play-icon">{isCurrentTrack && isPlaying ? '❚❚' : '▶'}</span>
      </button>
      
      {favorite ? (
        <button 
          className="vote-button"
          onClick={() => onVote(submission)}
          disabled={isSubmittingVote || isFinal}
        >
          {isFinal ? '✓ Voted' : 'Vote'}
        </button>
      ) : (
        <button 
          className="favorite-button"
          onClick={handleAddToFavorites}
          disabled={!listened}
        >
          {listened ? 'Add to favorites' : `Listen to ${listenedRatio}% to add`}
        </button>
      )}
    </div>
  );
}