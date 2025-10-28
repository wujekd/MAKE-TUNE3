import React, { useContext, useEffect, useRef, useState } from 'react';
import { DeskToggle } from './DeskToggle';
import { useAppStore } from '../stores/appStore';
import type { AudioState } from '../types';
import { AudioEngineContext } from '../audio-services/AudioEngineContext';
import { AnalogVUMeter } from './AnalogVUMeter';
import { SmallLEDMeter } from './SmallLEDMeter';
import { SubmissionEQ } from './SubmissionEQ';

interface MixerProps {
  state: AudioState;
}

export function Mixer({ state }: MixerProps) {
  const audioCtx = useContext(AudioEngineContext);
  const [masterLevel, setMasterLevel] = useState(0);
  const [player1Level, setPlayer1Level] = useState(0);
  const [player2Level, setPlayer2Level] = useState(0);
  const [submissionMuted, setSubmissionMuted] = useState(false);
  const masterLevelRef = useRef(0);
  const player1LevelRef = useRef(0);
  const player2LevelRef = useRef(0);
  const masterLastTsRef = useRef<number | null>(null);
  const player1LastTsRef = useRef<number | null>(null);
  const player2LastTsRef = useRef<number | null>(null);
  
  // Master level monitoring
  useEffect(() => {
    if (!audioCtx?.engine) return;
    const tauAttack = 0.1;
    const tauRelease = 0.5;
    const sensitivity = 4.5;
    const unsubscribe = audioCtx.engine.onMasterLevel(({ rms }) => {
      const now = performance.now();
      const last = masterLastTsRef.current ?? now;
      const dt = Math.max(0, (now - last) / 1000);
      masterLastTsRef.current = now;
      let d = masterLevelRef.current;
      const target = Math.max(0, Math.min(1, rms * sensitivity));
      const coeff = target > d
        ? 1 - Math.exp(-dt / tauAttack)
        : 1 - Math.exp(-dt / tauRelease);
      d = d + (target - d) * coeff;
      masterLevelRef.current = d;
      setMasterLevel(d);
    });
    return unsubscribe;
  }, [audioCtx?.engine]);
  
  // Player1 level monitoring
  useEffect(() => {
    if (!audioCtx?.engine) return;
    const tauAttack = 0.05;
    const tauRelease = 0.3;
    const sensitivity = 4.5;
    const unsubscribe = audioCtx.engine.onPlayer1Level(({ rms }) => {
      const now = performance.now();
      const last = player1LastTsRef.current ?? now;
      const dt = Math.max(0, (now - last) / 1000);
      player1LastTsRef.current = now;
      let d = player1LevelRef.current;
      const target = Math.max(0, Math.min(1, rms * sensitivity));
      const coeff = target > d
        ? 1 - Math.exp(-dt / tauAttack)
        : 1 - Math.exp(-dt / tauRelease);
      d = d + (target - d) * coeff;
      player1LevelRef.current = d;
      setPlayer1Level(d);
    });
    return unsubscribe;
  }, [audioCtx?.engine]);
  
  // Player2 level monitoring
  useEffect(() => {
    if (!audioCtx?.engine) return;
    const tauAttack = 0.05;
    const tauRelease = 0.3;
    const sensitivity = 4.5;
    const unsubscribe = audioCtx.engine.onPlayer2Level(({ rms }) => {
      const now = performance.now();
      const last = player2LastTsRef.current ?? now;
      const dt = Math.max(0, (now - last) / 1000);
      player2LastTsRef.current = now;
      let d = player2LevelRef.current;
      const target = Math.max(0, Math.min(1, rms * sensitivity));
      const coeff = target > d
        ? 1 - Math.exp(-dt / tauAttack)
        : 1 - Math.exp(-dt / tauRelease);
      d = d + (target - d) * coeff;
      player2LevelRef.current = d;
      setPlayer2Level(d);
    });
    return unsubscribe;
  }, [audioCtx?.engine]);
  const {
    handleSubmissionVolumeChange,
    handleMasterVolumeChange,
    handleTimeSliderChange,
    previousTrack,
    nextTrack,
    togglePlayPause,
    getCurrentTime,
    getTotalTime,
    getTimeSliderValue
  } = useAppStore(state => state.playback);

  const { regularTracks, favorites, pastStageTracks } = useAppStore(state => state.collaboration);

  const handleSubmissionVolumeChangeEvent = (e: React.ChangeEvent<HTMLInputElement>) => {
    const volume = parseFloat(e.target.value);
    handleSubmissionVolumeChange(volume);
  };

  const handleMasterVolumeChangeEvent = (e: React.ChangeEvent<HTMLInputElement>) => {
    const volume = parseFloat(e.target.value);
    handleMasterVolumeChange(volume);
  };

  const handleTimeSliderChangeEvent = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    handleTimeSliderChange(value);
  };

  // calculate canGoBack and canGoForward from state
  const pastStagePlayback = state.playerController.pastStagePlayback;
  const isPlayingFavourite = state.playerController.playingFavourite;
  const currentTrackIndex = state.playerController.currentTrackId;
  let canGoBack = false;
  let canGoForward = false;
  if (pastStagePlayback) {
    canGoBack = currentTrackIndex > 0;
    canGoForward = currentTrackIndex < pastStageTracks.length - 1;
  } else if (isPlayingFavourite) {
    canGoBack = currentTrackIndex > 0;
    canGoForward = currentTrackIndex < favorites.length - 1;
  } else {
    canGoBack = currentTrackIndex > 0;
    canGoForward = currentTrackIndex < regularTracks.length - 1;
  }

  return (
    <section className="mixer-section" id="mixer">
      <div className="transport">
        <button 
          id="back-btn" 
          onClick={previousTrack}
          disabled={!canGoBack}
        >
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="#ffffff">
            <path d="M8 24H40M8 24L16 16M8 24L16 32" stroke="#ffffff" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round"></path>
          </svg>
        </button>
        <button id="play-btn" onClick={togglePlayPause}>
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
          onClick={nextTrack}
          disabled={!canGoForward}
        >
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="#ffffff" transform="rotate(180)">
            <path d="M8 24H40M8 24L16 16M8 24L16 32" stroke="#ffffff" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round"></path>
          </svg>
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 12, color: 'var(--white)' }}>
          <span id="current-time">{getCurrentTime(state)}</span>
          <span>/</span>
          <span id="total-time">{getTotalTime(state)}</span>
        </div>
      </div>

      <div className="time-control">
        <input 
          type="range"
          className="time-slider"
          id="time-slider" 
          min="0" 
          max="100"
          step="0.1"
          value={getTimeSliderValue(state)}
          onChange={handleTimeSliderChangeEvent}
        />
      </div>

      <div className="channels-container">
        <div className="channel">
          <div className="volume-indicator"></div>
          <span className="channel-label">Submission</span>

          <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'center' }}>
            <SubmissionEQ />
          </div>
          <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'center' }}>
            <DeskToggle
              checked={submissionMuted}
              onChange={(next) => {
                if (!audioCtx?.engine) return;
                setSubmissionMuted(next);
                audioCtx.engine.setSubmissionMuted(next);
              }}
              label={undefined}
              size={12}
              colorOn="#d33"
              onText="mute"
              offText="unmute"
            />
          </div>
          <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'center' }}>
            <SmallLEDMeter value={player1Level} min={0} max={1} />
          </div>
          <input 
            type="range"
            className="vertical-slider"
            id="submission-volume" 
            min="0" 
            max="2"
            step="0.01"
            value={state.player1.volume}
            onChange={handleSubmissionVolumeChangeEvent}
          />
        </div>

        <div className="channel">
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
            <AnalogVUMeter value={masterLevel} min={0} max={1} size={100} />
          </div>
          <div className="volume-indicator"></div>
          <span className="channel-label">Master</span>
          <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'center' }}>
            <SmallLEDMeter value={player2Level} min={0} max={1} />
          </div>
          <input 
            type="range"
            className="vertical-slider"
            id="master-volume" 
            min="0" 
            max="1"
            step="0.01"
            value={state.master.volume}
            onChange={handleMasterVolumeChangeEvent}
          />
        </div>
      </div>
    </section>
  );
} 