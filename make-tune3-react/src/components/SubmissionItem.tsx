import React, { useContext } from "react";
import './SubmissionItem.css';
import { AudioEngineContext } from "../audio-services/AudioEngineContext";

export default ({ index, src, isPlaying, isCurrentTrack, listened, favorite, onAddToFavorites, onPlay, voteFor, listenedRatio }:
    { index: number, src: string, isPlaying: boolean, isCurrentTrack: boolean,
      listened: boolean,
      favorite: boolean,
      onAddToFavorites: (src: string) => void,
      onPlay: (src: string, index: number, favorite: boolean ) => void,
      voteFor: (src: string) => void,
      listenedRatio: number
    }) => {

  const submission = {
    markingListened: false,
    final: false,
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
    console.log('playSubmission called with:', src, index, favorite)
    onPlay(src, index, favorite);
  };
  
  const onVote = (sub: any) => {
    voteFor(src);
  };
  
  const handleAddToFavorites = () => {
    console.log('Add to favorites clicked for submission:', src);
    onAddToFavorites(src);
  };

  return (
    <div className={`
      submission-container
      ${isVotedFor ? 'voted-for' : ''}
      ${submission.markingListened ? 'marking' : ''}
      ${listened ? 'listened' : ''}
    `}>
      <div style={{ fontSize: '10px', color: 'white', marginBottom: '4px' }}>
        Index: {index} | Src: {src.substring(src.lastIndexOf('/') + 1)}
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
          disabled={isSubmittingVote || isVotedFor}
        >
          {isVotedFor ? '✓ Voted' : 'Vote'}
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