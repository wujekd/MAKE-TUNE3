import React, { useContext, useState } from 'react';
import { AudioEngineContext } from '../audio-services/AudioEngineContext';
import { usePlayerController } from '../hooks/usePlayerController';
import { DebugInfo } from '../components/DebugInfo';
import ProjectHistory from '../components/ProjectHistory';
import { Mixer } from '../components/Mixer';
import Favorites from '../components/Favorites';
import { useCollabData } from '../hooks/useCollabData';
import './MainView.css';
import SubmissionItem from '../components/SubmissionItem';

export function MainView() {
  const audioContext = useContext(AudioEngineContext);

  if (!audioContext) {
    return <div>Loading audio engine...</div>;
  }
  const { engine, state } = audioContext;
  const controller = usePlayerController(engine);

  const [debug, setDebug] = useState(false);
  const collabData = useCollabData();

  return (
    <div className="main-container">
      <button 
        style={{
          position: 'absolute',
          top: '20px',
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
            <Favorites />
          <div className="audio-player-title">Submissions</div>
            <div style={{ display: 'flex', flexDirection: 'row', gap: '10px', flexWrap: 'wrap' }}>
              {collabData.regularSubmissions.map((track, index) => (
                <SubmissionItem 
                  key={index}
                  index={index}
                  isCurrentTrack={state.player1.source == track}
                  isPlaying={state.player1.isPlaying}
                  listened={collabData.listened.includes(track)}
                />
              ))}
            </div>
        </div>
      </div>
      
      <Mixer engine={engine} state={state} />
      
    </div>
  );
}