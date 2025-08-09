import React, { useContext, useEffect, useRef, useState } from 'react';
import { DeskToggle } from './DeskToggle';
import { useAppStore } from '../stores/appStore';
import type { AudioState } from '../types';
import { AudioEngineContext } from '../audio-services/AudioEngineContext';
import { AnalogVUMeter } from './AnalogVUMeter';
import { SubmissionEQ } from './SubmissionEQ';

interface MixerProps {
  state: AudioState;
}

export function Mixer({ state }: MixerProps) {
  const audioCtx = useContext(AudioEngineContext);
  const [masterLevel, setMasterLevel] = useState(0);
  const [submissionMuted, setSubmissionMuted] = useState(false);
  const levelRef = useRef(0);
  const lastTsRef = useRef<number | null>(null);
  useEffect(() => {
    if (!audioCtx?.engine) return;
    const releasePerSec =1.3;
    const unsubscribe = audioCtx.engine.onMasterLevel(({ peak }) => {
      const now = performance.now();
      const last = lastTsRef.current ?? now;
      const dt = (now - last) / 1000;
      lastTsRef.current = now;
      let d = levelRef.current;
      const target = Math.max(0, Math.min(1, peak));
      if (target >= d) {
        d = target;
      } else {
        d = Math.max(target, d - releasePerSec * dt);
      }
      levelRef.current = d;
      setMasterLevel(d);
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

  const { regularTracks, favorites, pastStageTracks, isTrackFavorite } = useAppStore(state => state.collaboration);

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
  const currentTrackIndex = state.playerController.currentTrackId;
  
  let canGoBack = false;
  let canGoForward = false;
  
  if (pastStagePlayback) {
    canGoBack = currentTrackIndex > 0;
    canGoForward = currentTrackIndex < pastStageTracks.length - 1;
  } else {
    // determine if in favorites mode by checking currently playing track
    const currentTrackSrc = state.player1.source;
    if (!currentTrackSrc) {
      canGoBack = false;
      canGoForward = false;
    } else {
      const currentTrackFilePath = currentTrackSrc.replace('/test-audio/', '');
      const isCurrentTrackFavorite = isTrackFavorite(currentTrackFilePath);
      
      if (isCurrentTrackFavorite) {
        // check navigation within favorites array
        const favoriteIndex = favorites.findIndex(track => track.filePath === currentTrackFilePath);
        canGoBack = favoriteIndex > 0;
        canGoForward = favoriteIndex < favorites.length - 1;
              } else {
          // check navigation within regular tracks
        const currentTrack = regularTracks[currentTrackIndex];
        if (currentTrack) {
          canGoBack = currentTrackIndex > 0;
          canGoForward = currentTrackIndex < regularTracks.length - 1;
        } else {
          canGoBack = false;
          canGoForward = false;
        }
      }
    }
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
              size={18}
              colorOn="#d33"
              onText="mute"
              offText="unmute"
            />
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