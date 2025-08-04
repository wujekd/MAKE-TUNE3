import React, { useContext, useState } from 'react';
import { AudioEngineContext } from '../audio-services/AudioEngineContext';
import { usePlayerController } from '../hooks/usePlayerController';
import { DebugInfo } from '../components/DebugInfo';
import ProjectHistory from '../components/ProjectHistory';
import { Mixer } from '../components/Mixer';
import './MainView.css';

export function MainView() {
  const audioContext = useContext(AudioEngineContext);

  if (!audioContext) {
    return <div>Loading audio engine...</div>;
  }
  const { engine, state } = audioContext;
  const controller = usePlayerController(engine);

  const [debug, setDebug] = useState(false);

  return (
    <div className="main-container">
      <button 
        style={{
          position: 'absolute',
          top: '30px',
          right: '10px',
          zIndex: 1000,
        }}
        onClick={() => setDebug(!debug)}
      >
        {debug ? 'Show History' : 'Show Debug'}
      </button>
      <div className="info-top">
        <h2>Audio Engine Test</h2>
        {debug ? (
          <DebugInfo engine={engine} />
        ) : (
          <ProjectHistory />
        )}
      </div>
      
      <div className="submissions-section">
        <div className="audio-player-section">
          <div className="audio-player-title">Audio Player 1</div>
          <ul className="track-list">
            {controller.trackList.map((track, index) => (
              <li 
                key={index}
                className={`track-list-item ${index === controller.currentTrackIndex ? 'active' : ''}`}
                onClick={() => controller.playSubmission(index)}
              >
                {track}
              </li>
            ))}
          </ul>
        </div>
      </div>
      
      <Mixer engine={engine} state={state} />
    </div>
  );
}