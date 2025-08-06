import { create } from 'zustand';
import type { User } from '../types/auth';
import type { AudioEngine } from '../audio-services/audio-engine';
import type { AudioState } from '../types';
import { audioFiles } from '../data/mock-audio';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  sendPasswordResetEmail
} from 'firebase/auth';
import type { User as FirebaseUser } from 'firebase/auth';
import { auth } from '../services/firebase';
import { AuthService } from '../services/authService';

// Basic store interfaces for Phase 1
interface AppState {
  // Auth Slice
  user: User | null;
  authLoading: boolean;
  setUser: (user: User | null) => void;
  setAuthLoading: (loading: boolean) => void;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  initializeAuth: () => void;

  // Audio Engine Slice
  audioEngine: AudioEngine | null;
  setAudioEngine: (engine: AudioEngine) => void;

  // Audio State Slice (synced from AudioEngine)
  audioState: AudioState | null;
  setAudioState: (state: AudioState) => void;

  // Audio State Slice
  currentTrack: string | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  masterVolume: number;
  isPastStage: boolean;
  isFavorite: boolean;
  currentIndex: number;

  // Data Slice (all audio data)
  allSubmissions: string[];
  regularSubmissions: string[];
  pastStageTracklist: string[];
  backingTrackSrc: string;
  listened: string[];
  favourites: string[];
  finalVote: string;
  listenedRatio: number;

  // Data actions
  setAllSubmissions: (submissions: string[]) => void;
  setPastStageTracklist: (tracks: string[]) => void;
  setBackingTrackSrc: (track: string) => void;
  setListened: (listened: string[]) => void;
  setFavourites: (favourites: string[]) => void;
  setFinalVote: (vote: string) => void;
  addToFavourites: (src: string) => void;
  removeFromFavourites: (index: number) => void;
  markAsListened: (src: string) => void;
  voteFor: (src: string) => void;

  // UI State Slice
  isLoading: boolean;
  setLoading: (loading: boolean) => void;

  // Mixer Actions (from usePlayerController)
  handleSubmissionVolumeChange: (volume: number) => void;
  handleMasterVolumeChange: (volume: number) => void;
  handleTimeSliderChange: (value: number) => void;
  previousTrack: () => void;
  nextTrack: () => void;
  togglePlayPause: () => void;
  playSubmission: (src: string, index: number, favorite?: boolean) => void;
  playPastSubmission: (index: number) => void;
  getCurrentTime: (state: AudioState) => string;
  getTotalTime: (state: AudioState) => string;
  getTimeSliderValue: (state: AudioState) => number;
  canGoBack: boolean;
  canGoForward: boolean;
}

// Helper function to format time
const formatTime = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};

// Create the store with initial state
export const useAppStore = create<AppState>((set, get) => ({
  // Initial state
  user: null,
  authLoading: true,
  audioEngine: null,
  audioState: null,
  currentTrack: null,
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  volume: 100,
  masterVolume: 100,
  isPastStage: false,
  isFavorite: false,
  currentIndex: -1,
  allSubmissions: audioFiles.player1Files,
  regularSubmissions: audioFiles.player1Files.filter(submission => 
    !audioFiles.favourites.includes(submission)
  ),
  pastStageTracklist: audioFiles.pastStageFiles,
  backingTrackSrc: audioFiles.player2Files[0],
  listened: audioFiles.listened,
  favourites: audioFiles.favourites,
  finalVote: audioFiles.votedFor[0],
  listenedRatio: 5,
  isLoading: true,
  canGoBack: false,
  canGoForward: false,

  // Auth actions
  setUser: (user) => set({ user }),
  setAuthLoading: (loading) => set({ authLoading: loading }),

  initializeAuth: () => {
    console.log('🔐 Initializing auth...');
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      console.log('🔐 Auth state changed:', firebaseUser ? firebaseUser.email : 'null');
      if (firebaseUser) {
        try {
          console.log('🔐 Fetching user profile for:', firebaseUser.uid);
          const userProfile = await AuthService.getUserProfile(firebaseUser.uid);
          console.log('🔐 User profile fetched:', userProfile);
          set({ user: userProfile, authLoading: false });
        } catch (error) {
          console.error('🔐 Error fetching user profile:', error);
          set({ user: null, authLoading: false });
        }
      } else {
        console.log('🔐 No user, setting authLoading to false');
        set({ user: null, authLoading: false });
      }
    });

    // Return unsubscribe function for cleanup
    return unsubscribe;
  },

  signIn: async (email, password) => {
    try {
      console.log('🔐 Signing in with email:', email);
      set({ authLoading: true });
      const userProfile = await AuthService.loginWithEmail(email, password);
      console.log('🔐 Sign in successful:', userProfile);
      set({ user: userProfile, authLoading: false });
    } catch (error: any) {
      console.error('🔐 Sign in error:', error);
      set({ authLoading: false });
      throw error;
    }
  },

  signUp: async (email, password) => {
    try {
      set({ authLoading: true });
      const userProfile = await AuthService.registerWithEmail(email, password);
      set({ user: userProfile, authLoading: false });
    } catch (error: any) {
      set({ authLoading: false });
      console.error('Sign up error:', error);
      throw error;
    }
  },

  signOut: async () => {
    try {
      set({ authLoading: true });
      await AuthService.signOut();
      set({ user: null, authLoading: false });
    } catch (error: any) {
      set({ authLoading: false });
      console.error('Sign out error:', error);
      throw error;
    }
  },

  resetPassword: async (email) => {
    try {
      await AuthService.resetPassword(email);
    } catch (error: any) {
      console.error('Password reset error:', error);
      throw error;
    }
  },

  // Audio engine
  setAudioEngine: (engine) => set({ audioEngine: engine }),

  // Audio state sync
  setAudioState: (state) => set({ audioState: state }),

  // Data actions
  setAllSubmissions: (submissions) => {
    const { favourites } = get();
    const regularSubmissions = submissions.filter(submission => 
      !favourites.includes(submission)
    );
    set({ allSubmissions: submissions, regularSubmissions });
  },

  setPastStageTracklist: (tracks) => set({ pastStageTracklist: tracks }),

  setBackingTrackSrc: (track) => set({ backingTrackSrc: track }),

  setListened: (listened) => set({ listened }),

  setFavourites: (favourites) => {
    const { allSubmissions } = get();
    const regularSubmissions = allSubmissions.filter(submission => 
      !favourites.includes(submission)
    );
    set({ favourites, regularSubmissions });
  },

  setFinalVote: (vote) => set({ finalVote: vote }),

  addToFavourites: (src) => {
    const { favourites, allSubmissions, audioEngine } = get();
    if (src && !favourites.includes(src)) {
      const newFavourites = [...favourites, src];
      const regularSubmissions = allSubmissions.filter(submission => 
        !newFavourites.includes(submission)
      );
      
      set({ favourites: newFavourites, regularSubmissions });

      // Update engine if needed
      if (audioEngine) {
        const currentState = audioEngine.getState();
        const currentSource = currentState.player1.source;
        
        if (currentSource === src) {
          audioEngine.setPlayingFavourite(true);
          const newIndex = newFavourites.indexOf(src);
          audioEngine.updateCurrentTrackId(newIndex);
        } else if (currentSource && currentState.playerController.playingFavourite) {
          const newIndex = newFavourites.indexOf(currentSource);
          if (newIndex !== -1) {
            audioEngine.updateCurrentTrackId(newIndex);
          }
        } else if (currentSource && !currentState.playerController.playingFavourite && !currentState.playerController.pastStagePlayback) {
          const newIndex = regularSubmissions.indexOf(currentSource);
          if (newIndex !== -1) {
            audioEngine.updateCurrentTrackId(newIndex);
          }
        }
      }
    }
  },

  removeFromFavourites: (index) => {
    const { favourites, allSubmissions, audioEngine } = get();
    const submission = favourites[index];
    
    if (submission) {
      const newFavourites = favourites.filter((_, i) => i !== index);
      const regularSubmissions = allSubmissions.filter(submission => 
        !newFavourites.includes(submission)
      );
      
      set({ favourites: newFavourites, regularSubmissions });

      // Update engine if needed
      if (audioEngine) {
        const currentState = audioEngine.getState();
        const currentSource = currentState.player1.source;
        
        if (currentSource === submission) {
          audioEngine.setPlayingFavourite(false);
          const newIndex = regularSubmissions.indexOf(submission);
          audioEngine.updateCurrentTrackId(newIndex);
        } else if (currentSource && currentState.playerController.playingFavourite) {
          const newIndex = newFavourites.indexOf(currentSource);
          if (newIndex !== -1) {
            audioEngine.updateCurrentTrackId(newIndex);
          }
        } else if (currentSource && !currentState.playerController.playingFavourite && !currentState.playerController.pastStagePlayback) {
          const newIndex = regularSubmissions.indexOf(currentSource);
          if (newIndex !== -1) {
            audioEngine.updateCurrentTrackId(newIndex);
          }
        }
      }
    }
  },

  markAsListened: (src) => {
    const { listened } = get();
    if (src && !listened.includes(src)) {
      set({ listened: [...listened, src] });
    }
  },

  voteFor: (src) => set({ finalVote: src }),

  // UI actions
  setLoading: (loading) => set({ isLoading: loading }),

  // Mixer Actions
  handleSubmissionVolumeChange: (volume) => {
    const engine = get().audioEngine;
    if (engine) {
      engine.setVolume(1, volume);
    }
  },

  handleMasterVolumeChange: (volume) => {
    const engine = get().audioEngine;
    if (engine) {
      engine.setMasterVolume(volume);
    }
  },

  handleTimeSliderChange: (value) => {
    const engine = get().audioEngine;
    const state = get().audioState;
    if (!engine || !state) return;

    const pastStagePlayback = state.playerController.pastStagePlayback;
    const duration = pastStagePlayback ? state.player2.duration : state.player1.duration;
    if (duration > 0) {
      const newTime = (value / 100) * duration;
      engine.seek(newTime, pastStagePlayback);
    }
  },

  previousTrack: () => {
    const engine = get().audioEngine;
    const state = get().audioState;
    const { regularSubmissions, pastStageTracklist, favourites, backingTrackSrc } = get();
    
    if (!engine || !state) return;

    const pastStagePlayback = state.playerController.pastStagePlayback;
    const playingFavourite = state.playerController.playingFavourite;
    const currentTrackIndex = state.playerController.currentTrackId;

    if (pastStagePlayback) {
      if (currentTrackIndex > 0) {
        engine.playPastStage(pastStageTracklist[currentTrackIndex - 1], currentTrackIndex - 1);
      }
    } else if (playingFavourite) {
      if (currentTrackIndex > 0) {
        const prevTrackPath = favourites[currentTrackIndex - 1];
        engine.setPlayingFavourite(true);
        engine.playSubmission(prevTrackPath, backingTrackSrc, currentTrackIndex - 1);
      }
    } else {
      if (currentTrackIndex > 0) {
        const prevTrackPath = regularSubmissions[currentTrackIndex - 1];
        engine.setPlayingFavourite(false);
        engine.playSubmission(prevTrackPath, backingTrackSrc, currentTrackIndex - 1);
      }
    }
  },

  nextTrack: () => {
    const engine = get().audioEngine;
    const state = get().audioState;
    const { regularSubmissions, pastStageTracklist, favourites, backingTrackSrc } = get();
    
    if (!engine || !state) return;

    const pastStagePlayback = state.playerController.pastStagePlayback;
    const playingFavourite = state.playerController.playingFavourite;
    const currentTrackIndex = state.playerController.currentTrackId;

    if (pastStagePlayback) {
      if (currentTrackIndex < pastStageTracklist.length - 1) {
        engine.playPastStage(pastStageTracklist[currentTrackIndex + 1], currentTrackIndex + 1);
      }
    } else if (playingFavourite) {
      if (currentTrackIndex < favourites.length - 1) {
        const nextTrackPath = favourites[currentTrackIndex + 1];
        engine.setPlayingFavourite(true);
        engine.playSubmission(nextTrackPath, backingTrackSrc, currentTrackIndex + 1);
      }
    } else {
      if (currentTrackIndex < regularSubmissions.length - 1) {
        const nextTrackPath = regularSubmissions[currentTrackIndex + 1];
        engine.setPlayingFavourite(false);
        engine.playSubmission(nextTrackPath, backingTrackSrc, currentTrackIndex + 1);
      }
    }
  },

  togglePlayPause: () => {
    const engine = get().audioEngine;
    if (engine) {
      engine.togglePlayback();
    }
  },

  playSubmission: (src, index, favorite) => {
    const engine = get().audioEngine;
    const { backingTrackSrc } = get();
    
    if (!engine) return;

    if (favorite !== null && favorite !== undefined) {
      engine.setPlayingFavourite(favorite);
    }
    
    engine.playSubmission(src, backingTrackSrc, index);
  },

  playPastSubmission: (index) => {
    const engine = get().audioEngine;
    const { pastStageTracklist } = get();
    
    if (!engine) return;

    engine.playPastStage(pastStageTracklist[index], index);
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
})); 