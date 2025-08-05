import React, { useContext } from 'react';
import { AudioEngineContext } from '../audio-services/AudioEngineContext';
import './DebugInfo.css';

interface DebugInfoProps {
  engine?: any;
}

export function DebugInfo({ engine }: DebugInfoProps) {
  const audioContext = useContext(AudioEngineContext);

  if (!audioContext) {
    return <div>Loading audio engine...</div>;
  }

  const { state } = audioContext;

  return (
    <div className="debug-info">
      <div className="debug-grid">
        <div className="debug-column">
          <h4>Audio Engine</h4>
          <p>Master Volume: <span className="debug-value">{state.master.volume.toFixed(2)}</span></p>
          <p>Past Stage: <span className="debug-value">{state.playerController.pastStagePlayback ? 'Yes' : 'No'}</span></p>
          <p>Playing Favourite: <span className="debug-value">{state.playerController.playingFavourite ? 'Yes' : 'No'}</span></p>
          <p>Current Track ID: <span className="debug-value">{state.playerController.currentTrackId}</span></p>
          <div className="debug-buttons">
        <button id="test-btn" onClick={() => {
          const state = engine.getState();
          console.log('=== AUDIO ENGINE STATE TEST ===');
          console.log('Full State Object:', state);
          console.log('Player 1 Details:', {
            isPlaying: state.player1.isPlaying,
            currentTime: state.player1.currentTime,
            duration: state.player1.duration,
            volume: state.player1.volume,
            source: state.player1.source,
            hasEnded: state.player1.hasEnded,
            error: state.player1.error
          });
          console.log('Player 2 Details:', {
            isPlaying: state.player2.isPlaying,
            currentTime: state.player2.currentTime,
            duration: state.player2.duration,
            volume: state.player2.volume,
            source: state.player2.source,
            hasEnded: state.player2.hasEnded,
            error: state.player2.error
          });
          console.log('Player Controller:', {
            pastStagePlayback: state.playerController.pastStagePlayback,
            playingFavourite: state.playerController.playingFavourite,
            currentTrackId: state.playerController.currentTrackId
          });
          console.log('Master Volume:', state.master.volume);
          console.log('Engine Methods Available:', Object.getOwnPropertyNames(Object.getPrototypeOf(engine)));
          console.log('=== END TEST ===');
        }}>
          testy
        </button>
        <button id="test-play-btn" onClick={() => {
          console.log('=== TESTING PLAY SUBMISSION ===');
          const submissionSrc = '/test-audio/df9a07de-d40c-4e49-ab35-2c94f55e5137_phone%20from%20china.mp3';
          const backingSrc = '/test-audio/demo2%20instrumental.mp3';
          console.log('Playing submission:', submissionSrc);
          console.log('With backing track:', backingSrc);
          engine.playSubmission(submissionSrc, backingSrc);
          console.log('=== PLAY SUBMISSION CALLED ===');
        }}>
          test play
        </button>
      </div>
        </div>
        <div className="debug-column">
          <h4>Player 1</h4>
          <p>Status: <span className="debug-value">{state.player1.isPlaying ? 'Playing' : 'Stopped'}</span></p>
          <p>Source: <span className="debug-value">{state.player1.source || 'None'}</span></p>
          <p>Time: <span className="debug-value">{state.player1.currentTime.toFixed(2)}s / {state.player1.duration.toFixed(1)}s</span></p>
          <p>Volume: <span className="debug-value">{state.player1.volume.toFixed(2)}</span></p>
        </div>
        <div className="debug-column">
          <h4>Player 2</h4>
          <p>Status: <span className="debug-value">{state.player2.isPlaying ? 'Playing' : 'Stopped'}</span></p>
          <p>Source: <span className="debug-value">{state.player2.source || 'None'}</span></p>
          <p>Time: <span className="debug-value">{state.player2.currentTime.toFixed(2)}s / {state.player2.duration.toFixed(1)}s</span></p>
          <p>Volume: <span className="debug-value">{state.player2.volume.toFixed(2)}</span></p>
        </div>
      </div>
      
      
    </div>
  );
} 