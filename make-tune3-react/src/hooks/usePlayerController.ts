import { useEffect, useState } from 'react';
import { AudioEngine } from '../audio-services/audio-engine';
import { audioFiles } from '../data/mock-audio';
import { useCollabData } from './useCollabData';
import type { AudioState } from '../types';

export function usePlayerController(engine: AudioEngine | null) { // apparently its better to pass the audio engine even though its alwaqys the same engine ???

  const [trackList] = useState(audioFiles.player1Files);
  const [pastStageTracklist] = useState(audioFiles.pastStageFiles);
  const [backingTrackSrc] = useState(audioFiles.player2Files[0]);

  const pastStagePlayback = engine ? engine.getState().playerController.pastStagePlayback : false;
  const currentTrackIndex = engine ? engine.getState().playerController.currentTrackId : -2;

  const collabData = useCollabData();

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
    engine.togglePlayback();
  };

  const nextTrack = () => {
    if (pastStagePlayback) {
      if (currentTrackIndex < pastStageTracklist.length - 1) {
        playPastSubmission(currentTrackIndex + 1);
      }
    } else {
      if (currentTrackIndex < trackList.length - 1) {
        playSubmission(currentTrackIndex + 1);
      }
    }
  };

  const previousTrack = () => {
    if (pastStagePlayback) {
      if (currentTrackIndex > 0) {
        playPastSubmission(currentTrackIndex - 1);
      }
    } else {
      if (currentTrackIndex > 0) {
        playSubmission(currentTrackIndex - 1);
      }
    }
  };

  const playSubmission = (index: number, favourite?: boolean) => {
    if (index >= 0 && index < trackList.length) {
      const trackPath = collabData.regularSubmissions[index];
      engine?.playSubmission(trackPath, backingTrackSrc, index);
    }
  };

  const playPastSubmission = (index: number) => {
    engine?.playPastStage(collabData.pastStageTracklist[index], index);
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
  const canGoForward = pastStagePlayback
    ? currentTrackIndex < collabData.pastStageTracklist.length - 1
    : currentTrackIndex < collabData.regularSubmissions.length - 1;

  const handleSubmissionVolumeChange = (volume: number) => {
    if (!engine) return;
    engine.setVolume(1, volume);
  };

  const handleMasterVolumeChange = (volume: number) => {
    if (!engine) return;
    engine.setMasterVolume(volume);
  };

  // Backing track init when engine loads
  useEffect(() => {
    if (engine) {
      engine.loadSource(2, backingTrackSrc); // TODO : load from useCollabData
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
    handleSubmissionVolumeChange,
    handleMasterVolumeChange,
    
    // Utilities
    formatTime,
    getTimeSliderValue,
    getCurrentTime,
    getTotalTime
  };
}