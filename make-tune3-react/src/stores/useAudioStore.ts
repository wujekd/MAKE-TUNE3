import { create } from 'zustand';
import type { AudioEngine } from '../audio-services/audio-engine';
import type { AudioState } from '../types';

interface AudioStoreState {
  engine: AudioEngine | null;
  state: AudioState | null;
  setEngine: (engine: AudioEngine | null) => void;
  setState: (state: AudioState | null) => void;
}

export const useAudioStore = create<AudioStoreState>((set) => ({
  engine: null,
  state: null,

  setEngine: (engine) => set({ engine }),
  setState: (state) => set({ state })
}));
