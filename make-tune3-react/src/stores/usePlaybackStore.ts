import { create } from 'zustand';
import type { AudioState } from '../types';
import { AudioUrlUtils, PlaybackUtils } from '../utils';
import { useAudioStore } from './useAudioStore';
import { useCollaborationStore } from './useCollaborationStore';

const DEBUG_LOGS = true;
const resolveAudioUrl = AudioUrlUtils.resolveAudioUrl;
const formatTime = PlaybackUtils.formatTime;

type BackingPreviewState = {
  label: string;
  sourceType: 'storage' | 'file';
  path?: string;
  url: string;
  isObjectUrl: boolean;
};

interface PlaybackState {
  backingPreview: BackingPreviewState | null;
  handleSubmissionVolumeChange: (volume: number) => void;
  handleMasterVolumeChange: (volume: number) => void;
  handleTimeSliderChange: (value: number) => void;
  previousTrack: () => void;
  nextTrack: () => void;
  togglePlayPause: () => void;
  playSubmission: (filePath: string, index: number, favorite?: boolean) => void;
  playPastSubmission: (index: number) => void;
  playBackingTrack: (filePath: string, label?: string) => void;
  previewBackingFile: (file: File) => void;
  stopBackingPlayback: () => void;
  getCurrentTime: (state: AudioState) => string;
  getTotalTime: (state: AudioState) => string;
  getTimeSliderValue: (state: AudioState) => number;
}

export const usePlaybackStore = create<PlaybackState>((set, get) => {
  const cleanupBackingPreview = () => {
    const current = get().backingPreview;
    if (current?.isObjectUrl && typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
      URL.revokeObjectURL(current.url);
    }
    return current;
  };

  return {
    backingPreview: null,

    handleSubmissionVolumeChange: (volume) => {
      const engine = useAudioStore.getState().engine;
      if (engine) {
        engine.setVolume(1, volume);
      }
    },

    handleMasterVolumeChange: (volume) => {
      const engine = useAudioStore.getState().engine;
      if (engine) {
        engine.setMasterVolume(volume);
      }
    },

    handleTimeSliderChange: (value) => {
      const engine = useAudioStore.getState().engine;
      const state = useAudioStore.getState().state;
      if (!engine || !state) return;

      const pastStagePlayback = state.playerController.pastStagePlayback;
      const duration = pastStagePlayback ? state.player2.duration : state.player1.duration;
      if (duration > 0) {
        const newTime = (value / 100) * duration;
        engine.seek(newTime, pastStagePlayback);
      }
    },

    previousTrack: () => {
      const engine = useAudioStore.getState().engine;
      const audioState = useAudioStore.getState().state;
      const { regularTracks, favorites, pastStageTracks, backingTrack } = useCollaborationStore.getState();

      if (!engine || !audioState) return;

      const pastStagePlayback = audioState.playerController.pastStagePlayback;
      const currentTrackIndex = audioState.playerController.currentTrackId;

      if (pastStagePlayback) {
        (async () => {
          if (currentTrackIndex > 0) {
            const track = pastStageTracks[currentTrackIndex - 1];
            const src = await resolveAudioUrl(track.optimizedPath || track.filePath);
            engine.playPastStage(src, '', currentTrackIndex - 1);
          }
        })();
      } else {
        const playingFav = audioState.playerController.playingFavourite;
        (async () => {
          if (playingFav) {
            if (currentTrackIndex > 0) {
              const track = favorites[currentTrackIndex - 1];
              engine.setPlayingFavourite(true);
              const chosenPathPrevFav = track.optimizedPath || track.filePath;
              if (DEBUG_LOGS) console.log('previousTrack (favorites) path selected:', track.optimizedPath ? 'optimizedPath' : 'originalPath', chosenPathPrevFav);
              const submissionSrc = await resolveAudioUrl(chosenPathPrevFav);
              const backingSrc = backingTrack?.filePath ? await resolveAudioUrl(backingTrack.filePath) : '';
              engine.playSubmission(submissionSrc, backingSrc, currentTrackIndex - 1);
            }
          } else {
            if (currentTrackIndex > 0) {
              const track = regularTracks[currentTrackIndex - 1];
              engine.setPlayingFavourite(false);
              const chosenPathPrevReg = track.optimizedPath || track.filePath;
              if (DEBUG_LOGS) console.log('previousTrack (regular) path selected:', track.optimizedPath ? 'optimizedPath' : 'originalPath', chosenPathPrevReg);
              const submissionSrc = await resolveAudioUrl(chosenPathPrevReg);
              const backingSrc = backingTrack?.filePath ? await resolveAudioUrl(backingTrack.filePath) : '';
              engine.playSubmission(submissionSrc, backingSrc, currentTrackIndex - 1);
            }
          }
        })();
      }
    },

    nextTrack: () => {
      const engine = useAudioStore.getState().engine;
      const audioState = useAudioStore.getState().state;
      const { regularTracks, favorites, pastStageTracks, backingTrack } = useCollaborationStore.getState();

      if (!engine || !audioState) return;

      const pastStagePlayback = audioState.playerController.pastStagePlayback;
      const currentTrackIndex = audioState.playerController.currentTrackId;

      if (pastStagePlayback) {
        (async () => {
          if (currentTrackIndex < pastStageTracks.length - 1) {
            const track = pastStageTracks[currentTrackIndex + 1];
            const src = await resolveAudioUrl(track.optimizedPath || track.filePath);
            engine.playPastStage(src, '', currentTrackIndex + 1);
          }
        })();
      } else {
        const playingFav = audioState.playerController.playingFavourite;
        (async () => {
          if (playingFav) {
            if (currentTrackIndex < favorites.length - 1) {
              const track = favorites[currentTrackIndex + 1];
              engine.setPlayingFavourite(true);
              const chosenPathNextFav = track.optimizedPath || track.filePath;
              if (DEBUG_LOGS) console.log('nextTrack (favorites) path selected:', track.optimizedPath ? 'optimizedPath' : 'originalPath', chosenPathNextFav);
              const submissionSrc = await resolveAudioUrl(chosenPathNextFav);
              const backingSrc = backingTrack?.filePath ? await resolveAudioUrl(backingTrack.filePath) : '';
              engine.playSubmission(submissionSrc, backingSrc, currentTrackIndex + 1);
            }
          } else {
            if (currentTrackIndex < regularTracks.length - 1) {
              const track = regularTracks[currentTrackIndex + 1];
              engine.setPlayingFavourite(false);
              const chosenPathNextReg = track.optimizedPath || track.filePath;
              if (DEBUG_LOGS) console.log('nextTrack (regular) path selected:', track.optimizedPath ? 'optimizedPath' : 'originalPath', chosenPathNextReg);
              const submissionSrc = await resolveAudioUrl(chosenPathNextReg);
              const backingSrc = backingTrack?.filePath ? await resolveAudioUrl(backingTrack.filePath) : '';
              engine.playSubmission(submissionSrc, backingSrc, currentTrackIndex + 1);
            }
          }
        })();
      }
    },

    togglePlayPause: () => {
      const engine = useAudioStore.getState().engine;
      if (engine) {
        engine.togglePlayback();
      }
    },

    playSubmission: (filePath, index, favorite) => {
      if (DEBUG_LOGS) console.log('playSubmission called with:', { filePath, index, favorite });
      const engine = useAudioStore.getState().engine;
      const audioState = useAudioStore.getState().state as any;
      const { backingTrack, currentCollaboration, getTrackByFilePath } = useCollaborationStore.getState();
      const track = getTrackByFilePath(filePath);

      if (!engine || !track) {
        if (DEBUG_LOGS) console.log('playSubmission - no engine or track found');
        return;
      }

      if (favorite !== null && favorite !== undefined) {
        if (DEBUG_LOGS) console.log('playSubmission - setting playingFavourite to:', favorite);
        engine.setPlayingFavourite(favorite);
      } else {
        if (DEBUG_LOGS) console.log('playSubmission - favorite parameter is null/undefined');
      }

      cleanupBackingPreview();
      set({ backingPreview: null });

      (async () => {
        const settings = track.submissionSettings;
        if (DEBUG_LOGS) console.log('applying submission settings (optimistic):', settings);
        const engineInstance = engine;
        if (settings && engineInstance) {
          engineInstance.setVolume(1, settings.volume?.gain ?? 1);
          const eq = settings.eq;
          const eqPayload: any = {
            highpass: { frequency: eq?.highpass?.frequency ?? audioState?.eq.highpass.frequency ?? 20, Q: audioState?.eq.highpass.Q ?? 0.7 },
            param1: { frequency: eq?.param1?.frequency ?? audioState?.eq.param1.frequency, Q: eq?.param1?.Q ?? audioState?.eq.param1.Q, gain: eq?.param1?.gain ?? audioState?.eq.param1.gain },
            param2: { frequency: eq?.param2?.frequency ?? audioState?.eq.param2.frequency, Q: eq?.param2?.Q ?? audioState?.eq.param2.Q, gain: eq?.param2?.gain ?? audioState?.eq.param2.gain },
            highshelf: { frequency: eq?.highshelf?.frequency ?? audioState?.eq.highshelf.frequency, gain: eq?.highshelf?.gain ?? audioState?.eq.highshelf.gain }
          };
          if (DEBUG_LOGS) console.log('eq before apply:', audioState?.eq, 'payload:', eqPayload);
          engineInstance.setEq(eqPayload);
          if (DEBUG_LOGS) console.log('eq after apply (state):', audioState?.eq, 'p1 volume:', audioState?.player1.volume);
        }
        const chosenPath = track.optimizedPath || track.filePath;
        if (DEBUG_LOGS) console.log('playSubmission path selected:', track.optimizedPath ? 'optimizedPath' : 'originalPath', chosenPath);
        const submissionSrc = await resolveAudioUrl(chosenPath);
        let backingSrc = '';
        const backingPath = backingTrack?.filePath || currentCollaboration?.backingTrackPath || '';
        if (backingPath) {
          backingSrc = await resolveAudioUrl(backingPath);
        } else if (audioState?.player2?.source) {
          backingSrc = audioState.player2.source as string;
        }
        engine.playSubmission(submissionSrc, backingSrc, index);
      })();
    },

    playPastSubmission: (index) => {
      const engine = useAudioStore.getState().engine;
      const { pastStageTracks } = useCollaborationStore.getState();

      if (!engine || !pastStageTracks[index]) return;

      cleanupBackingPreview();
      set({ backingPreview: null });

      (async () => {
        const src = await resolveAudioUrl(pastStageTracks[index].filePath);
        engine.playPastStage(src, '', index);
      })();
    },

    playBackingTrack: (filePath, label) => {
      if (!filePath) return;
      const engine = useAudioStore.getState().engine;
      if (!engine) return;

      (async () => {
        const startTime = performance.now();
        try {
          cleanupBackingPreview();

          // Measure URL resolution time
          const urlResolveStart = performance.now();
          const resolved = await resolveAudioUrl(filePath);
          const urlResolveTime = performance.now() - urlResolveStart;

          // Measure play start time
          const playStart = performance.now();
          await engine.playBackingOnly(resolved);
          const playTime = performance.now() - playStart;

          const totalTime = performance.now() - startTime;
          console.log(`[usePlaybackStore] 🎵 Backing track play timing:
  - URL resolution: ${urlResolveTime.toFixed(0)}ms
  - Play start: ${playTime.toFixed(0)}ms
  - Total: ${totalTime.toFixed(0)}ms`);

          set({
            backingPreview: {
              label: label || decodeURIComponent(filePath.split('/').pop() || 'backing'),
              sourceType: 'storage',
              path: filePath,
              url: resolved,
              isObjectUrl: false
            }
          });
        } catch (err) {
          if (DEBUG_LOGS) console.warn('[usePlaybackStore] failed to play backing track', err);
        }
      })();
    },

    previewBackingFile: (file) => {
      if (!file) return;
      const engine = useAudioStore.getState().engine;
      if (!engine) return;

      (async () => {
        let url: string | null = null;
        try {
          cleanupBackingPreview();
          url = URL.createObjectURL(file);
          await engine.playBackingOnly(url);
          set({
            backingPreview: {
              label: file.name,
              sourceType: 'file',
              url,
              isObjectUrl: true
            }
          });
        } catch (err) {
          if (url && typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
            URL.revokeObjectURL(url);
          }
          if (DEBUG_LOGS) console.warn('[usePlaybackStore] failed to preview backing file', err);
        }
      })();
    },

    stopBackingPlayback: () => {
      const engine = useAudioStore.getState().engine;
      if (engine) {
        engine.stopBackingPlayback();
      }
      cleanupBackingPreview();
      set({ backingPreview: null });
    },

    getCurrentTime: (state) => {
      const pastStagePlayback = state.playerController.pastStagePlayback;
      const currentTime = pastStagePlayback ? state.player2.currentTime : state.player1.currentTime;
      return formatTime(currentTime);
    },

    getTotalTime: (state) => {
      const pastStagePlayback = state.playerController.pastStagePlayback;
      const duration = pastStagePlayback ? state.player2.duration : state.player1.duration;
      return formatTime(duration);
    },

    getTimeSliderValue: (state) => {
      const pastStagePlayback = state.playerController.pastStagePlayback;
      const currentTime = pastStagePlayback ? state.player2.currentTime : state.player1.currentTime;
      const duration = pastStagePlayback ? state.player2.duration : state.player1.duration;

      if (duration > 0) {
        return (currentTime / duration) * 100;
      }
      return 0;
    }
  };
});
