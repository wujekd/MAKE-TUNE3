import React, { useEffect, useRef, useState } from 'react';
import type { AudioState } from '../types';
import { useAppStore } from '../stores/appStore';
import { useAudioStore } from '../stores';
import { usePlaybackStore } from '../stores/usePlaybackStore';
import { AnalogVUMeter } from './AnalogVUMeter';
import { SmallLEDMeter } from './SmallLEDMeter';
import { Potentiometer } from './Potentiometer';
import { WeightedFader } from './WeightedFader';
import { MasterSpectrogramCanvas } from './MasterSpectrogramCanvas';
import { ChannelScopeCanvas } from './ChannelScopeCanvas';

interface Mixer1ChannelProps {
  state: AudioState | null;
}

export function Mixer1Channel({ state }: Mixer1ChannelProps) {
  const audioEngine = useAudioStore(s => s.engine);
  const [masterLevel, setMasterLevel] = useState(0);
  const [channelLevel, setChannelLevel] = useState(0);
  const [isCompactMode, setIsCompactMode] = useState(window.innerHeight < 700);
  const masterLevelRef = useRef(0);
  const channelLevelRef = useRef(0);
  const masterLastTsRef = useRef<number | null>(null);
  const channelLastTsRef = useRef<number | null>(null);

  const {
    handleBackingVolumeChange,
    handleMasterVolumeChange,
    handleTimeSliderChange,
    togglePlayPause,
    getCurrentTime,
    getTotalTime,
    getTimeSliderValue
  } = useAppStore(s => s.playback);
  const stopBackingPlayback = usePlaybackStore(s => s.stopBackingPlayback);

  // Window height responsive behavior
  useEffect(() => {
    const handleResize = () => {
      setIsCompactMode(window.innerHeight < 700);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!audioEngine) return;
    const tauAttack = 0.1;
    const tauRelease = 0.3;
    const sensitivity = 8.5;
    const unsubscribe = audioEngine.onMasterLevel(({ rms }) => {
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
  }, [audioEngine]);

  useEffect(() => {
    if (!audioEngine) return;
    const tauAttack = 0.05;
    const tauRelease = 0.3;
    const sensitivity = 4.5;
    const unsubscribe = audioEngine.onPlayer2Level(({ rms }) => {
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
  }, [audioEngine]);

  if (!state) {
    return null;
  }

  const handleTimeSliderChangeEvent = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    handleTimeSliderChange(value);
  };

  const isPlaying = state.player2.isPlaying;
  const hasSource = Boolean(state.player2.source);

  // Brightness effect strength controls
  const brightnessMultiplier = 0.1;  // How much brighter (0.4 = up to 1.4x at peak)
  const glowSpread = 70;              // Glow spread in pixels
  const glowOpacity = 0.3;            // Glow opacity (0-1)
  const peakThreshold = 0.75;          // Only react to audio above this level (0-1)

  // Calculate how much above threshold (0 if below threshold)
  const aboveThreshold = Math.max(0, masterLevel - peakThreshold);
  // Scale to full range (0-1) based on remaining headroom
  const peakIntensity = aboveThreshold / (1 - peakThreshold);

  const brightnessValue = 1 + (peakIntensity * brightnessMultiplier);
  const glowIntensity = peakIntensity * glowSpread;
  const currentGlowOpacity = peakIntensity * glowOpacity;

  return (
    <section
      className="mixer-section mixer-section--single"
      id="mixer-1-channel"
      style={{
        filter: `brightness(${brightnessValue})`,
        boxShadow: `inset 0 0 ${glowIntensity}px rgba(var(--mixer-glow-rgb, 255, 255, 255), ${currentGlowOpacity})`,
        transition: 'filter 0.05s ease-out, box-shadow 0.05s ease-out',
        maxHeight: '100%',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      <div className="transport" style={{ flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%' }}>
          <button
            className="play-btn transport-btn"
            onClick={togglePlayPause}
            disabled={!hasSource}
            aria-label={isPlaying ? 'Pause' : 'Play'}
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? '⏸' : '▶'}
          </button>
          <button
            id="stop-btn"
            className="transport-btn"
            onClick={() => stopBackingPlayback()}
            disabled={!hasSource}
            aria-label="Stop"
            title="Stop"
          >
            ■
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, color: 'var(--dashboard-text-muted)', fontSize: 10 }}>
          <span>{getCurrentTime(state)}</span>
          <span>/</span>
          <span>{getTotalTime(state)}</span>
        </div>
        <input
          type="range"
          className="time-slider"
          min="0"
          max="100"
          step="0.1"
          value={getTimeSliderValue(state)}
          onChange={handleTimeSliderChangeEvent}
          disabled={!hasSource}
        />
      </div>

      <div className="mixer1-channel" style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'visible' }}>
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flexShrink: 0 }}>
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
              engine={audioEngine}
              style={{
                height: isCompactMode ? 56 : 72,
                minHeight: isCompactMode ? 56 : 72
              }}
            />
          </div>

          <div
            aria-hidden="true"
            style={{
              width: '100%',
              height: 1,
              margin: '8px 0 6px',
              background: 'rgba(255, 255, 255, 0.14)',
              flexShrink: 0
            }}
          />

          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, flex: 1, minHeight: 0, justifyContent: 'flex-end' }}>
            <ChannelScopeCanvas
              engine={audioEngine}
              source="backing"
              ariaLabel="Backing waveform scope"
              style={{
                height: isCompactMode ? 28 : 36,
                minHeight: isCompactMode ? 28 : 36,
                marginBottom: 8
              }}
            />
            <div
              style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flex: 0,
                width: '100%',
                minHeight: isCompactMode ? 96 : 184
              }}
            >
              {isCompactMode ? (
                <Potentiometer
                  ariaLabel="Backing volume"
                  value={state.player2.volume}
                  min={0}
                  max={1}
                  step={0.01}
                  size={64}
                  onChange={handleBackingVolumeChange}
                  onInput={handleBackingVolumeChange}
                  showValue={false}
                  exponent={2}
                />
              ) : (
                <WeightedFader
                  id="mixer1-backing-volume"
                  value={state.player2.volume}
                  min={0}
                  max={1}
                  step={0.01}
                  exponent={2}
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
                <SmallLEDMeter value={channelLevel} min={0} max={1} vertical={true} />
              </div>
            </div>
            <span className="mixer1-channel-label mixer1-channel-label--bottom">Backing</span>
          </div>
        </div>
      </div>
    </section>
  );
}
