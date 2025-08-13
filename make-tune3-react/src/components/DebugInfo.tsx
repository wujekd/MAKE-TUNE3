import React, { useContext } from 'react';
import { AudioEngineContext } from '../audio-services/AudioEngineContext';
import './DebugInfo.css';
import { useAppStore } from '../stores/appStore';

interface DebugInfoProps {
  engine?: any;
}

export function DebugInfo({ engine }: DebugInfoProps) {
  const audioContext = useContext(AudioEngineContext);
  const { regularTracks, isTrackFavorite } = useAppStore(s => s.collaboration);

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
          <div>
            <button id="dbg-log-mode" onClick={() => {
              console.log('playingFavourite:', state.playerController.playingFavourite);
            }}>
              Log Playback Mode
            </button>
            <button id="dbg-log-favs" onClick={() => {
              const favs = regularTracks.filter(t => isTrackFavorite(t.filePath));
              console.log('favourites:', favs);
            }}>
              Log Favorites
            </button>
          </div>  
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