import { useEffect } from 'react';
import { AudioEngine } from '../audio-services/audio-engine';
import type { AudioState } from '../types';

export function usePlayerController(engine: AudioEngine | null, { regularSubmissions, pastStageTracklist, favourites, backingTrackSrc }: { regularSubmissions: string[], pastStageTracklist: string[], favourites: string[], backingTrackSrc: string }) {

  const pastStagePlayback = engine ? engine.getState().playerController.pastStagePlayback : false;
  const currentTrackIndex = engine ? engine.getState().playerController.currentTrackId : -2;
  let playingFavourite = engine ? engine.getState().playerController.playingFavourite : false;

  useEffect(() => {
    console.log("player controller rerender");
  }, [favourites]);

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
    } else if (playingFavourite) {
      if (currentTrackIndex < favourites.length - 1) {
        const nextTrackPath = favourites[currentTrackIndex + 1];
        playSubmission(nextTrackPath, currentTrackIndex + 1, true);
      }
    } else {
      if (currentTrackIndex < regularSubmissions.length - 1) {
        const nextTrackPath = regularSubmissions[currentTrackIndex + 1];
        playSubmission(nextTrackPath, currentTrackIndex + 1, false);
      }
    }
  };

  const previousTrack = () => {
    if (pastStagePlayback) {
      if (currentTrackIndex > 0) {
        playPastSubmission(currentTrackIndex - 1);
      }
    } else if (playingFavourite) {
      if (currentTrackIndex > 0) {
        const prevTrackPath = favourites[currentTrackIndex - 1];
        playSubmission(prevTrackPath, currentTrackIndex - 1, true);
      }
    } else {
      if (currentTrackIndex > 0) {
        const prevTrackPath = regularSubmissions[currentTrackIndex - 1];
        playSubmission(prevTrackPath, currentTrackIndex - 1, false);
      }
    }
  };

  const playSubmission = (trackPath: string, index: number, favourite?: boolean) => {
    console.log('playSubmission triggered with:', { trackPath, index, favourite });
    if (favourite !== null && favourite !== undefined && engine) {
      engine.setPlayingFavourite(favourite);
      playingFavourite = favourite;
    }
    
    console.log('playing favourite flag: ', playingFavourite);
    console.log("track path: ", trackPath)
    engine?.playSubmission(trackPath, backingTrackSrc, index);
  };

  const playPastSubmission = (index: number) => {
    engine?.playPastStage(pastStageTracklist[index], index);
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
    ? currentTrackIndex < pastStageTracklist.length - 1
    : playingFavourite
    ? currentTrackIndex < favourites.length - 1
    : currentTrackIndex < regularSubmissions.length - 1;

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
    if (engine && backingTrackSrc) {
      const currentState = engine.getState();
      if (currentState.player2.source !== backingTrackSrc) {
        engine.loadSource(2, backingTrackSrc);
      }
    }
  }, [engine, backingTrackSrc]);

  return {
    currentTrackIndex,
    pastStagePlayback,
    canGoBack,
    canGoForward,
    playingFavourite,
    
    togglePlayPause,
    nextTrack,
    previousTrack,
    playSubmission,
    playPastSubmission,
    handleTimeSliderChange,
    handleSubmissionVolumeChange,
    handleMasterVolumeChange,
    
    formatTime,
    getTimeSliderValue,
    getCurrentTime,
    getTotalTime
  };
}