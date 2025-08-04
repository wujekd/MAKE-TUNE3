import React, { useContext, useEffect, useRef } from "react";
import './SubmissionItem.css';
import { usePlayerController } from "../hooks/usePlayerController";
import { AudioEngineContext } from "../audio-services/AudioEngineContext";

export default ({ index, isPlaying, isCurrentTrack, listened }:
    { index: number, isPlaying: boolean, isCurrentTrack: boolean, listened: boolean }) => {

  const submission = {
    id: 'temp-1',
    audioUrl: '/test-audio/temp.mp3',
    favorited: false,
    markingListened: false,
    final: false,
    collabId: 'temp-collab'
  };

  const audioContext = useContext(AudioEngineContext);
  if (!audioContext) {
    return <div>Loading audio engine...</div>;
  }
  const { engine, state } = audioContext;
  const playerController = usePlayerController(engine);
  
  const isVotedFor = false;
  const isInFavorites = false;
  const isSubmittingVote = false;
  

  const displayProgress = isCurrentTrack && state.player1.duration > 0 
    ? (state.player1.currentTime / state.player1.duration) * 100 
    : 0;
  
  const handlePlayClick = () => {
    playerController.playSubmission(index)
  };
  
  const onVote = (sub: any) => {
    console.log('Vote clicked for submission:', sub.id);
  };
  
  const onAddToFavorites = (sub: any) => {
    console.log('Add to favorites clicked for submission:', sub.id);
  };

  return (
    <div className={`
      submission-container
      ${isVotedFor ? 'voted-for' : ''}
      ${submission.markingListened ? 'marking' : ''}
      ${listened ? 'listened' : ''}
    `}>
      <button 
        className="play-button" 
        onClick={handlePlayClick}
      >
        <div className="progress-bar" style={{ width: `${displayProgress}%` }}></div>
        <span className="play-icon">{isCurrentTrack && isPlaying ? '❚❚' : '▶'}</span>
      </button>
      
      {isInFavorites ? (
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
          onClick={() => onAddToFavorites(submission)}
          disabled={!listened}
        >
          {listened ? 'Add to favorites' : 'Listen to 80% to add'}
        </button>
      )}
    </div>
  );
}