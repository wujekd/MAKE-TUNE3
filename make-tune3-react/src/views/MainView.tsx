import React, { useContext } from 'react';
import { AudioEngineContext } from '../audio-services/AudioEngineContext';
import { usePlayerController } from '../hooks/usePlayerController';
import './MainView.css';

export function MainView() {
  const audioContext = useContext(AudioEngineContext);

  if (!audioContext) {
    return <div>Loading audio engine...</div>;
  }

  const { engine, state } = audioContext;
  const controller = usePlayerController(engine);

  const handleSubmissionVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const volume = parseFloat(e.target.value);
    engine.setVolume(1, volume);
  };

  const handleMasterVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const volume = parseFloat(e.target.value);
    engine.setMasterVolume(volume);
  };

  const handleTimeSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    controller.handleTimeSliderChange(value);
  };

  return (
    <div className="main-container">
      <div className="info-top">
        <h2>Audio Engine Test</h2>
        <div className="debug-info">
          <div className="debug-grid">
            <div className="debug-column">
              <h4>Audio Engine</h4>
              <p>Context: <span className="debug-value">Active</span></p>
              <p>Master Volume: <span className="debug-value">{state.master.volume.toFixed(2)}</span></p>
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
        <div className="audio-player-section">
          <div className="audio-player-title">Past Stages</div>
          <ul className="track-list">
            {controller.pastStageTracklist.map((track, index) => (
              <li 
                key={index}
                className="track-list-item"
                onClick={() => controller.playPastSubmission(index)}
              >
                {track}
              </li>
            ))}
          </ul>
        </div>
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
      
      <section className="mixer-section" id="mixer">
        <div className="transport">
          <button 
            id="back-btn" 
            onClick={controller.previousTrack}
            disabled={!controller.canGoBack}
          >
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="#ffffff">
              <path d="M4 12H20M4 12L8 8M4 12L8 16" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path>
            </svg>
          </button>
          <button id="play-btn" onClick={controller.togglePlayPause}>
            <svg width="17" height="17" viewBox="-3 0 28 28" fill="#ffffff">
              <path d="M21.4,13.5L4.4,1.3C3.3,0.7,2,0.8,2,2.9v20.1c0,2,1.4,2.3,2.4,1.6l17-12.2C22.2,11.6,22.2,14.3,21.4,13.5"/>
            </svg>
          </button>
          <button 
            id="fwd-btn" 
            onClick={controller.nextTrack}
            disabled={!controller.canGoForward}
          >
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="#ffffff" transform="rotate(180)">
              <path d="M4 12H20M4 12L8 8M4 12L8 16" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path>
            </svg>
          </button>
        </div>

        <div className="time-control">
          <div className="time-display">
            <span id="current-time">{controller.getCurrentTime(state)}</span>
            <span>/</span>
            <span id="total-time">{controller.getTotalTime(state)}</span>
          </div>
          <input 
            type="range"
            className="time-slider"
            id="time-slider" 
            min="0" 
            max="100"
            step="0.1"
            value={controller.getTimeSliderValue(state)}
            onChange={handleTimeSliderChange}
          />
        </div>

        <div className="channels-container">
          <div className="channel">
            <div className="volume-indicator"></div>
            <span className="channel-label">Submission</span>
            <input 
              type="range"
              className="vertical-slider"
              id="submission-volume" 
              min="0" 
              max="2"
              step="0.01"
              value={state.player1.volume}
              onChange={handleSubmissionVolumeChange}
            />
          </div>

          <div className="channel">
            <div className="volume-indicator"></div>
            <span className="channel-label">Master</span>
            <input 
              type="range"
              className="vertical-slider"
              id="master-volume" 
              min="0" 
              max="1"
              step="0.01"
              value={state.master.volume}
              onChange={handleMasterVolumeChange}
            />
          </div>
        </div>
      </section>
    </div>
  );
}