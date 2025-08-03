import { useEffect, useState } from 'react';
import { AudioEngine } from '../audio-services/audio-engine';
import { audioFiles } from '../data/mock-audio';
import type { AudioState } from '../types';

export function usePlayerController(engine: AudioEngine | null) {
  const [currentTrackIndex, setCurrentTrackIndex] = useState(-1);
  const [pastStagePlayback, setPastStagePlayback] = useState(false);
  const [trackList] = useState(audioFiles.player1Files);
  const [pastStageTracklist] = useState(audioFiles.pastStageFiles);
  const [backingTrackSrc] = useState(audioFiles.player2Files[0]);

  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const handleTimeSliderChange = (value: number) => {
    if (!engine) return;

    const state = engine.getState();
    const duration = pastStagePlayback ? state.player2.duration : state.player1.duration;
    if (duration > 0) {
      const newTime = (value / 100) * duration;
      engine.seek(newTime, pastStagePlayback);
    }
  };

  const togglePlayPause = () => {
    if (!engine) return;
    
    if (pastStagePlayback) {
      engine.toggleP2();
    } else {
      engine.toggleBoth();
    }
  };

  const nextTrack = () => {
    if (currentTrackIndex < trackList.length - 1) {
      playSubmission(currentTrackIndex + 1);
    }
  };

  const previousTrack = () => {
    if (currentTrackIndex > 0) {
      playSubmission(currentTrackIndex - 1);
    }
  };

  const playSubmission = (index: number) => {
    if (index >= 0 && index < trackList.length) {
      if (pastStagePlayback) {
        setPastStagePlayback(false);
      }
      setCurrentTrackIndex(index);
      const trackPath = trackList[index];
      engine?.playSubmission(trackPath, backingTrackSrc);
    }
  };

  const playPastSubmission = (index: number) => {
    if (!pastStagePlayback) {
      setPastStagePlayback(true);
    }
    engine?.playPastStage(pastStageTracklist[index]);
  };

  const getTimeSliderValue = (state: AudioState): number => {
    const currentTime = pastStagePlayback ? state.player2.currentTime : state.player1.currentTime;
    const duration = pastStagePlayback ? state.player2.duration : state.player1.duration;
    
    if (duration > 0) {
      return (currentTime / duration) * 100;
    }
    return 0;
  };

  const getCurrentTime = (state: AudioState): string => {
    const currentTime = pastStagePlayback ? state.player2.currentTime : state.player1.currentTime;
    return formatTime(currentTime);
  };

  const getTotalTime = (state: AudioState): string => {
    const duration = pastStagePlayback ? state.player2.duration : state.player1.duration;
    return formatTime(duration);
  };

  const canGoBack = currentTrackIndex > 0;
  const canGoForward = currentTrackIndex < trackList.length - 1;

  // Initialize backing track when engine is available
  useEffect(() => {
    if (engine) {
      engine.loadSource(2, backingTrackSrc);
    }
  }, [engine, backingTrackSrc]);

  return {
    // State
    currentTrackIndex,
    pastStagePlayback,
    trackList,
    pastStageTracklist,
    canGoBack,
    canGoForward,
    
    // Actions
    togglePlayPause,
    nextTrack,
    previousTrack,
    playSubmission,
    playPastSubmission,
    handleTimeSliderChange,
    
    // Utilities
    formatTime,
    getTimeSliderValue,
    getCurrentTime,
    getTotalTime
  };
}