import React, { useContext, useEffect, useRef, useState } from "react";
import './SubmissionItem.css';
import { usePlayerController } from "../hooks/usePlayerController";

import { AudioEngineContext } from "../audio-services/AudioEngineContext";

export default ({ index, src, isPlaying, isCurrentTrack, listened, favorite, onAddToFavorites }:
    { index: number, src: string, isPlaying: boolean, isCurrentTrack: boolean, listened: boolean, favorite: boolean, onAddToFavorites: (src: string) => void }) => {

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
  const isSubmittingVote = false;

 
  const displayProgress = isCurrentTrack && state.player1.duration > 0 
    ? (state.player1.currentTime / state.player1.duration) * 100 
    : 0;
  
  const handlePlayClick = () => {
    // console.log('playSubmission called with:', src, favorite)
    playerController.playSubmission(src, index, favorite);
  };
  
  const onVote = (sub: any) => {
    console.log('Vote clicked for submission:', sub.id);
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
          {listened ? 'Add to favorites' : 'Listen to 80% to add'}
        </button>
      )}
    </div>
  );
}