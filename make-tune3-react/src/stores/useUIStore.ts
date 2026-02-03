import { create } from 'zustand';
import type { FeedbackCategory } from '../services/feedbackService';

interface FeedbackModalState {
  isOpen: boolean;
  initialCategory: FeedbackCategory | null;
}

interface UIState {
  isLoading: boolean;
  showAuth: boolean;
  debug: boolean;
  feedbackModal: FeedbackModalState;
  setLoading: (loading: boolean) => void;
  setShowAuth: (show: boolean) => void;
  setDebug: (debug: boolean) => void;
  openFeedbackModal: (category?: FeedbackCategory) => void;
  closeFeedbackModal: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  isLoading: false,
  showAuth: false,
  debug: false,
  feedbackModal: {
    isOpen: false,
    initialCategory: null
  },

  setLoading: (loading) => set({ isLoading: loading }),
  setShowAuth: (show) => set({ showAuth: show }),
  setDebug: (debug) => set({ debug }),
  openFeedbackModal: (category) => set({
    feedbackModal: {
      isOpen: true,
      initialCategory: category ?? null
    }
  }),
  closeFeedbackModal: () => set({
    feedbackModal: {
      isOpen: false,
      initialCategory: null
    }
  })
}));

