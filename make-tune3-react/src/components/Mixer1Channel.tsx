import React, { useContext, useEffect, useRef, useState } from 'react';
import type { AudioState } from '../types';
import { AudioEngineContext } from '../audio-services/AudioEngineContext';
import { useAppStore } from '../stores/appStore';
import { usePlaybackStore } from '../stores/usePlaybackStore';
import { AnalogVUMeter } from './AnalogVUMeter';
import { SmallLEDMeter } from './SmallLEDMeter';

interface Mixer1ChannelProps {
  state: AudioState | null;
}

export function Mixer1Channel({ state }: Mixer1ChannelProps) {
  const audioCtx = useContext(AudioEngineContext);
  const [masterLevel, setMasterLevel] = useState(0);
  const [channelLevel, setChannelLevel] = useState(0);
  const masterLevelRef = useRef(0);
  const channelLevelRef = useRef(0);
  const masterLastTsRef = useRef<number | null>(null);
  const channelLastTsRef = useRef<number | null>(null);

  const {
    handleMasterVolumeChange,
    handleTimeSliderChange,
    togglePlayPause,
    getCurrentTime,
    getTotalTime,
    getTimeSliderValue
  } = useAppStore(s => s.playback);
  const stopBackingPlayback = usePlaybackStore(s => s.stopBackingPlayback);
  const backingPreview = usePlaybackStore(s => s.backingPreview);

  useEffect(() => {
    if (!audioCtx?.engine) return;
    const tauAttack = 0.1;
    const tauRelease = 0.4;
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

  useEffect(() => {
    if (!audioCtx?.engine) return;
    const tauAttack = 0.05;
    const tauRelease = 0.3;
    const sensitivity = 4.5;
    const unsubscribe = audioCtx.engine.onPlayer2Level(({ rms }) => {
      const now = performance.now();
      const last = channelLastTsRef.current ?? now;
      const dt = Math.max(0, (now - last) / 1000);
      channelLastTsRef.current = now;
      let d = channelLevelRef.current;
      const target = Math.max(0, Math.min(1, rms * sensitivity));
      const coeff = target > d
        ? 1 - Math.exp(-dt / tauAttack)
        : 1 - Math.exp(-dt / tauRelease);
      d = d + (target - d) * coeff;
      channelLevelRef.current = d;
      setChannelLevel(d);
    });
    return unsubscribe;
  }, [audioCtx?.engine]);

  if (!state) {
    return null;
  }

  const handleMasterVolumeChangeEvent = (e: React.ChangeEvent<HTMLInputElement>) => {
    const volume = parseFloat(e.target.value);
    handleMasterVolumeChange(volume);
  };

  const handleTimeSliderChangeEvent = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    handleTimeSliderChange(value);
  };

  const isPlaying = state.player2.isPlaying;
  const hasSource = Boolean(state.player2.source);

  return (
    <section className="mixer-section mixer-section--single" id="mixer-1-channel">
      <div className="mixer1-transport">
        <div className="mixer1-transport-buttons">
          <button 
            id="mixer1-play-btn" 
            className="mixer1-button"
            onClick={togglePlayPause}
            disabled={!hasSource}
          >
            {isPlaying ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="#ffffff">
                <rect x="6" y="4" width="4" height="16" fill="#ffffff" />
                <rect x="14" y="4" width="4" height="16" fill="#ffffff" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="-3 0 28 28" fill="#ffffff">
                <path d="M21.4,13.5L4.4,1.3C3.3,0.7,2,0.8,2,2.9v20.1c0,2,1.4,2.3,2.4,1.6l17-12.2C22.2,11.6,22.2,14.3,21.4,13.5"/>
              </svg>
            )}
          </button>
          <button 
            id="mixer1-stop-btn"
            className="mixer1-button"
            onClick={() => stopBackingPlayback()}
            disabled={!hasSource}
          >
            stop
          </button>
        </div>
        <div className="mixer1-timing">
          <span>{getCurrentTime(state)}</span>
          <span>/</span>
          <span>{getTotalTime(state)}</span>
        </div>
      </div>

      <div className="mixer1-time-wrapper">
        <input
          type="range"
          className="time-slider mixer1-time-slider"
          min="0"
          max="100"
          step="0.1"
          value={getTimeSliderValue(state)}
          onChange={handleTimeSliderChangeEvent}
          disabled={!hasSource}
        />
      </div>

      <div className="mixer1-channel">
        <div className="mixer1-meter">
          <AnalogVUMeter value={masterLevel} min={0} max={1} size={72} />
        </div>
        <span className="mixer1-channel-label">master</span>
        <div className="mixer1-led">
          <SmallLEDMeter value={channelLevel} min={0} max={1} />
        </div>
        <input
          type="range"
          className="vertical-slider mixer1-fader"
          id="mixer1-master-volume"
          min="0"
          max="1"
          step="0.01"
          value={state.master.volume}
          onChange={handleMasterVolumeChangeEvent}
        />
      </div>

      <div className="mixer1-status">
        {backingPreview ? `now playing: ${backingPreview.label}` : 'load a backing track to listen'}
      </div>
    </section>
  );
}
