import { create } from 'zustand';

interface UIState {
  isLoading: boolean;
  showAuth: boolean;
  debug: boolean;
  setLoading: (loading: boolean) => void;
  setShowAuth: (show: boolean) => void;
  setDebug: (debug: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  isLoading: false,
  showAuth: false,
  debug: false,

  setLoading: (loading) => set({ isLoading: loading }),
  setShowAuth: (show) => set({ showAuth: show }),
  setDebug: (debug) => set({ debug })
}));

