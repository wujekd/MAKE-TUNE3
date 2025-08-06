import { create } from 'zustand';
import type { User } from '../types/auth';
import type { AudioEngine } from '../audio-services/audio-engine';
import { audioFiles } from '../data/mock-audio';

// Basic store interfaces for Phase 1
interface AppState {
  // Auth Slice
  user: User | null;
  setUser: (user: User | null) => void;
  
  // Audio Engine Slice
  audioEngine: AudioEngine | null;
  setAudioEngine: (engine: AudioEngine) => void;
  
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
  
  // Data Slice
  submissions: string[];
  pastStageTracks: string[];
  backingTrack: string;
  favorites: string[];
  listened: string[];
  finalVote: string | null;
  listenedRatio: number;
  
  // UI State Slice
  isLoading: boolean;
  setLoading: (loading: boolean) => void;
}

// Create the store with initial state
export const useAppStore = create<AppState>((set, get) => ({
  // Initial state
  user: null,
  audioEngine: null,
  currentTrack: null,
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  volume: 100,
  masterVolume: 100,
  isPastStage: false,
  isFavorite: false,
  currentIndex: -1,
  submissions: audioFiles.player1Files,
  pastStageTracks: audioFiles.pastStageFiles,
  backingTrack: audioFiles.player2Files[0],
  favorites: audioFiles.favourites,
  listened: audioFiles.listened,
  finalVote: audioFiles.votedFor[0],
  listenedRatio: 5,
  isLoading: true,
  
  // Auth actions
  setUser: (user) => set({ user }),
  
  // Audio engine
  setAudioEngine: (engine) => set({ audioEngine: engine }),
  
  // UI actions
  setLoading: (loading) => set({ isLoading: loading })
})); 