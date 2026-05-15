import React, { useContext, useEffect, useRef, useState } from 'react';
import { useAppStore } from '../stores/appStore';
import type { AudioState } from '../types';
import { AudioEngineContext } from '../audio-services/AudioEngineContext';
import { AnalogVUMeter } from './AnalogVUMeter';
import { SmallLEDMeter } from './SmallLEDMeter';
import { SubmissionEQ } from './SubmissionEQ';
import { Potentiometer } from './Potentiometer';
import { WeightedFader } from './WeightedFader';
import { MasterSpectrogramCanvas } from './MasterSpectrogramCanvas';
import { ChannelScopeCanvas } from './ChannelScopeCanvas';
import type { SubmissionSettings } from '../types/collaboration';

interface MixerProps {
  state: AudioState;
}

export function Mixer({ state }: MixerProps) {
  const audioCtx = useContext(AudioEngineContext);
  const [masterLevel, setMasterLevel] = useState(0);
  const [player1Level, setPlayer1Level] = useState(0);
  const [player2Level, setPlayer2Level] = useState(0);
  const [submissionMuted, setSubmissionMuted] = useState(false);
  const [windowHeight, setWindowHeight] = useState(window.innerHeight);
  const masterLevelRef = useRef(0);
  const player1LevelRef = useRef(0);
  const player2LevelRef = useRef(0);
  const masterLastTsRef = useRef<number | null>(null);
  const player1LastTsRef = useRef<number | null>(null);
  const player2LastTsRef = useRef<number | null>(null);

  // Window height responsive behavior
  useEffect(() => {
    const handleResize = () => {
      setWindowHeight(window.innerHeight);
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
  const handleSubmissionVolumeChange = useAppStore(state => state.playback.handleSubmissionVolumeChange);
  const handleBackingVolumeChange = useAppStore(state => state.playback.handleBackingVolumeChange);
  const handleMasterVolumeChange = useAppStore(state => state.playback.handleMasterVolumeChange);
  const handleTimeSliderChange = useAppStore(state => state.playback.handleTimeSliderChange);
  const previousTrack = useAppStore(state => state.playback.previousTrack);
  const nextTrack = useAppStore(state => state.playback.nextTrack);
  const togglePlayPause = useAppStore(state => state.playback.togglePlayPause);
  const getCurrentTime = useAppStore(state => state.playback.getCurrentTime);
  const getTotalTime = useAppStore(state => state.playback.getTotalTime);
  const getTimeSliderValue = useAppStore(state => state.playback.getTimeSliderValue);

  const regularTracks = useAppStore(state => state.collaboration.regularTracks);
  const favorites = useAppStore(state => state.collaboration.favorites);
  const pastStageTracks = useAppStore(state => state.collaboration.pastStageTracks);

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

  let activeSubmissionSettings: SubmissionSettings | undefined;
  if (hasActiveTrack) {
    if (pastStagePlayback) {
      activeSubmissionSettings = pastStageTracks[currentTrackIndex]?.submissionSettings;
    } else if (isPlayingFavourite) {
      activeSubmissionSettings = favorites[currentTrackIndex]?.submissionSettings;
    } else {
      activeSubmissionSettings = regularTracks[currentTrackIndex]?.submissionSettings;
    }
  }

  const isExtraCompact = windowHeight < 750;
  const isCompact = windowHeight < 850;
  const isSubmissionCompact = isCompact;
  const isMasterCompact = isCompact;
  const compactVolumeEncoderSize = isExtraCompact ? 34 : 64;
  const meterLedCount = isExtraCompact ? 3 : 6;
  const scopeHeight = Math.min(48, Math.max(28, Math.round(28 + (windowHeight - 700) * 0.04)));
  const submissionScopeHeight = scopeHeight;
  const backingScopeHeight = scopeHeight;
  const submissionScopeMinHeight = 28;
  const backingScopeMinHeight = 28;
  const showOscilloscopes = windowHeight >= 800;
  const faderHeight = Math.min(184, Math.max(132, Math.round(132 + (windowHeight - 850) * 0.32)));
  const submissionFaderMinHeight = isSubmissionCompact ? 98 : faderHeight;
  const backingFaderMinHeight = isMasterCompact ? 98 : faderHeight;
  const faderStyle: React.CSSProperties = {
    width: faderHeight
  };
  const lowerAreaStyle: React.CSSProperties = {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    minHeight: 0,
    justifyContent: 'flex-end'
  };
  const faderStackStyle: React.CSSProperties = {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 0,
    flexShrink: 0
  };
  const scopeSlotStyle = (height: number): React.CSSProperties => ({
    width: '100%',
    minHeight: height + 32,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 14,
    boxSizing: 'border-box',
    flexShrink: 0
  });
  const scopeCanvasStyle = (height: number, minHeight: number): React.CSSProperties => ({
    height,
    minHeight,
    marginBottom: 0
  });

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
        <div className="mixer1-channel" style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'visible', gap: 0 }}>
          <div className="mixer1-meter" style={{ flexShrink: 0 }}>
            <SubmissionEQ
              muted={submissionMuted}
              currentEq={state.eq}
              trackKey={`${pastStagePlayback ? 'past' : isPlayingFavourite ? 'fav' : 'regular'}:${currentTrackIndex}:${state.player1.source ?? ''}`}
              savedEq={activeSubmissionSettings?.eq}
              onMuteChange={(next) => {
                if (!audioCtx?.engine) return;
                setSubmissionMuted(next);
                audioCtx.engine.setSubmissionMuted(next);
              }}
            />
          </div>

          <div style={lowerAreaStyle}>
            {showOscilloscopes && (
              <div style={scopeSlotStyle(submissionScopeHeight)}>
                <ChannelScopeCanvas
                  engine={audioCtx?.engine}
                  source="submission"
                  ariaLabel="Submission waveform scope"
                  style={scopeCanvasStyle(submissionScopeHeight, submissionScopeMinHeight)}
                />
              </div>
            )}
            <div style={faderStackStyle}>
            <div
              style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                width: '100%',
                minHeight: submissionFaderMinHeight
              }}
            >
              {isSubmissionCompact ? (
                <Potentiometer
                  value={state.player1.volume}
                  min={0}
                  max={2}
                  step={0.01}
                  size={compactVolumeEncoderSize}
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
                  style={faderStyle}
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
                <SmallLEDMeter value={player1Level} min={0} max={1} vertical={true} ledCount={meterLedCount} />
              </div>
            </div>
            <span className="mixer1-channel-label mixer1-channel-label--bottom" style={{ marginTop: 0 }}>Submission</span>
            </div>
          </div>
        </div>

        <div className="mixer1-channel" style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'visible', gap: 0 }}>
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, flexShrink: 0 }}>
              <div className="mixer1-meter" style={{ flexShrink: 0 }}>
                <AnalogVUMeter value={masterLevel} min={0} max={1} size={72} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="mixer1-channel-label">Master</span>
                <Potentiometer
                  ariaLabel="Master volume"
                  value={state.master.volume}
                  min={0}
                  max={1}
                  step={0.01}
                  size={22}
                  onChange={handleMasterVolumeChange}
                  onInput={handleMasterVolumeChange}
                  showValue={false}
                  showDragLabel={false}
                  exponent={2}
                />
              </div>
              <MasterSpectrogramCanvas
                engine={audioCtx?.engine}
                style={{
                  height: 72,
                  minHeight: 72
                }}
              />
            </div>

            <div
              aria-hidden="true"
              style={{
                width: '100%',
                height: 1,
                margin: '4px 0',
                background: 'rgba(255, 255, 255, 0.14)',
                flexShrink: 0
              }}
            />

            <div style={lowerAreaStyle}>
                {showOscilloscopes && (
                  <div style={scopeSlotStyle(backingScopeHeight)}>
                    <ChannelScopeCanvas
                      engine={audioCtx?.engine}
                      source="backing"
                      ariaLabel="Backing waveform scope"
                      style={scopeCanvasStyle(backingScopeHeight, backingScopeMinHeight)}
                    />
                  </div>
                )}
              <div style={faderStackStyle}>
                <div
                  style={{
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flex: 0,
                    width: '100%',
                    minHeight: backingFaderMinHeight
                  }}
                >
                  {isMasterCompact ? (
                    <Potentiometer
                      ariaLabel="Backing volume"
                      value={state.player2.volume}
                      min={0}
                      max={1}
                      step={0.01}
                      size={compactVolumeEncoderSize}
                      onChange={handleBackingVolumeChange}
                      onInput={handleBackingVolumeChange}
                      showValue={false}
                      exponent={2}
                    />
                  ) : (
                    <WeightedFader
                      id="backing-volume"
                      value={state.player2.volume}
                      min={0}
                      max={1}
                      step={0.01}
                      exponent={2}
                      style={faderStyle}
                      onChange={handleBackingVolumeChange}
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
                    <SmallLEDMeter value={player2Level} min={0} max={1} vertical={true} ledCount={meterLedCount} />
                  </div>
                </div>
                <span className="mixer1-channel-label mixer1-channel-label--bottom" style={{ marginTop: 0 }}>Backing</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section >
  );
}
