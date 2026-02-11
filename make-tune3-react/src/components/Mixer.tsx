import React, { useContext, useEffect, useRef, useState } from 'react';
import { DeskToggle } from './DeskToggle';
import { useAppStore } from '../stores/appStore';
import type { AudioState } from '../types';
import { AudioEngineContext } from '../audio-services/AudioEngineContext';
import { AnalogVUMeter } from './AnalogVUMeter';
import { SmallLEDMeter } from './SmallLEDMeter';
import { SubmissionEQ } from './SubmissionEQ';
import { Potentiometer } from './Potentiometer';
import { WeightedFader } from './WeightedFader';

interface MixerProps {
  state: AudioState;
}

export function Mixer({ state }: MixerProps) {
  const audioCtx = useContext(AudioEngineContext);
  const [masterLevel, setMasterLevel] = useState(0);
  const [player1Level, setPlayer1Level] = useState(0);
  const [player2Level, setPlayer2Level] = useState(0);
  const [submissionMuted, setSubmissionMuted] = useState(false);
  const [isSubmissionCompact, setIsSubmissionCompact] = useState(window.innerHeight < 850);
  const [isMasterCompact, setIsMasterCompact] = useState(window.innerHeight < 700);
  const masterLevelRef = useRef(0);
  const player1LevelRef = useRef(0);
  const player2LevelRef = useRef(0);
  const masterLastTsRef = useRef<number | null>(null);
  const player1LastTsRef = useRef<number | null>(null);
  const player2LastTsRef = useRef<number | null>(null);

  // Window height responsive behavior
  useEffect(() => {
    const handleResize = () => {
      setIsSubmissionCompact(window.innerHeight < 850);
      setIsMasterCompact(window.innerHeight < 700);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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
  const hasActiveTrack = currentTrackIndex >= 0;
  let canGoBack = false;
  let canGoForward = false;
  if (hasActiveTrack) {
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
  }

  return (
    <section className="mixer-section" id="mixer">
      <div className="transport">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%' }}>
          <button
            id="back-btn"
            className="transport-btn"
            onClick={previousTrack}
            disabled={!canGoBack}
            aria-label="Previous track"
            title="Previous track"
          >
            ⏮
          </button>
          <button
            className="play-btn transport-btn"
            onClick={togglePlayPause}
            aria-label={state.player2.isPlaying ? 'Pause' : 'Play'}
            title={state.player2.isPlaying ? 'Pause' : 'Play'}
          >
            {state.player2.isPlaying ? '⏸' : '▶'}
          </button>
          <button
            id="fwd-btn"
            className="transport-btn"
            onClick={nextTrack}
            disabled={!canGoForward}
            aria-label="Next track"
            title="Next track"
          >
            ⏭
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 8, color: 'var(--white)' }}>
            <span id="current-time">{getCurrentTime(state)}</span>
            <span>/</span>
            <span id="total-time">{getTotalTime(state)}</span>
          </div>
        </div>
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
        <div className="mixer1-channel" style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'visible' }}>
          <div className="mixer1-meter" style={{ flexShrink: 0 }}>
            <SubmissionEQ
              muted={submissionMuted}
              onMuteChange={(next) => {
                if (!audioCtx?.engine) return;
                setSubmissionMuted(next);
                audioCtx.engine.setSubmissionMuted(next);
              }}
            />
          </div>

          <div style={{ flex: 1, minHeight: 0 }} />

          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <div
              style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                width: '100%',
                minHeight: isSubmissionCompact ? 96 : 184
              }}
            >
              {isSubmissionCompact ? (
                <Potentiometer
                  value={state.player1.volume}
                  min={0}
                  max={2}
                  step={0.01}
                  size={64}
                  onChange={handleSubmissionVolumeChange}
                  onInput={handleSubmissionVolumeChange}
                  showValue={false}
                  exponent={2}
                />
              ) : (
                <WeightedFader
                  id="submission-volume"
                  value={state.player1.volume}
                  min={0}
                  max={2}
                  step={0.01}
                  exponent={2}
                  onChange={handleSubmissionVolumeChange}
                />
              )}
              <div
                style={{
                  position: 'absolute',
                  right: '8%',
                  top: 0,
                  bottom: 0,
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                <SmallLEDMeter value={player1Level} min={0} max={1} vertical={true} />
              </div>
            </div>
            <span className="mixer1-channel-label mixer1-channel-label--bottom">Submission</span>
          </div>
        </div>

        <div className="mixer1-channel" style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'visible' }}>
          <div className="mixer1-meter" style={{ flexShrink: 0 }}>
            <AnalogVUMeter value={masterLevel} min={0} max={1} size={72} />
          </div>

          <div style={{ flex: 1, minHeight: 0 }} />

          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, marginTop: 'auto' }}>
            <div
              style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                width: '100%',
                minHeight: isMasterCompact ? 96 : 184
              }}
            >
              {isMasterCompact ? (
                <Potentiometer
                  value={state.master.volume}
                  min={0}
                  max={1}
                  step={0.01}
                  size={64}
                  onChange={handleMasterVolumeChange}
                  onInput={handleMasterVolumeChange}
                  showValue={false}
                  exponent={2}
                />
              ) : (
                <WeightedFader
                  id="master-volume"
                  value={state.master.volume}
                  min={0}
                  max={1}
                  step={0.01}
                  exponent={2}
                  onChange={handleMasterVolumeChange}
                />
              )}
              <div
                style={{
                  position: 'absolute',
                  right: '8%',
                  top: 0,
                  bottom: 0,
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                <SmallLEDMeter value={player2Level} min={0} max={1} vertical={true} />
              </div>
            </div>
            <span className="mixer1-channel-label mixer1-channel-label--bottom">Master</span>
          </div>
        </div>
      </div>
    </section >
  );
}
