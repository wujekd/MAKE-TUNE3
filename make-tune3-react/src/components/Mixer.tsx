import React from 'react';
import type { AudioState } from '../types';
import { usePlayerController } from '../hooks/usePlayerController';

interface MixerProps {
  engine: any;
  state: AudioState;
  regularSubmissions: string[];
  pastStageTracklist: string[];
  favourites: string[];
  backingTrackSrc: string;
}

export function Mixer({ engine, state, regularSubmissions, pastStageTracklist, favourites, backingTrackSrc }: MixerProps) {
  const controller = usePlayerController(engine, {
    regularSubmissions,
    pastStageTracklist,
    favourites,
    backingTrackSrc
  });

  const handleSubmissionVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => { // dw its just a fancy parameter change type
    const volume = parseFloat(e.target.value);
    controller.handleSubmissionVolumeChange(volume);
  };

  const handleMasterVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const volume = parseFloat(e.target.value);
    controller.handleMasterVolumeChange(volume);
  };

  const handleTimeSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    controller.handleTimeSliderChange(value);
  };

  return (
    <section className="mixer-section" id="mixer">
      <div className="transport">
        <button 
          id="back-btn" 
          onClick={controller.previousTrack}
          disabled={!controller.canGoBack}
        >
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="#ffffff">
            <path d="M8 24H40M8 24L16 16M8 24L16 32" stroke="#ffffff" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round"></path>
          </svg>
        </button>
        <button id="play-btn" onClick={controller.togglePlayPause}>
          {state.player2.isPlaying ? (
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="#ffffff">
              <rect x="6" y="4" width="4" height="16" fill="#ffffff"/>
              <rect x="14" y="4" width="4" height="16" fill="#ffffff"/>
            </svg>
          ) : (
            <svg width="32" height="32" viewBox="-3 0 28 28" fill="#ffffff">
              <path d="M21.4,13.5L4.4,1.3C3.3,0.7,2,0.8,2,2.9v20.1c0,2,1.4,2.3,2.4,1.6l17-12.2C22.2,11.6,22.2,14.3,21.4,13.5"/>
            </svg>
          )}
        </button>
        <button 
          id="fwd-btn" 
          onClick={controller.nextTrack}
          disabled={!controller.canGoForward}
        >
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="#ffffff" transform="rotate(180)">
            <path d="M8 24H40M8 24L16 16M8 24L16 32" stroke="#ffffff" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round"></path>
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
  );
} 