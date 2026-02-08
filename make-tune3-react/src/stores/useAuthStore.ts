import { create } from 'zustand';
import { onAuthStateChanged } from 'firebase/auth';
import type { User as FirebaseUser } from 'firebase/auth';
import type { User } from '../types/auth';
import { auth } from '../services/firebase';
import { AuthService } from '../services/authService';

const DEBUG_LOGS = false;

interface AuthState {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, username?: string) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  initializeAuth: () => (() => void);
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,

  signIn: async (email, password) => {
    try {
      if (DEBUG_LOGS) console.log('signing in with email:', email);
      set({ loading: true });
      const userProfile = await AuthService.loginWithEmail(email, password);
      if (DEBUG_LOGS) console.log('sign in successful:', userProfile);
      set({ user: userProfile, loading: false });
    } catch (error: any) {
      if (DEBUG_LOGS) console.error('sign in error:', error);
      set({ loading: false });
      throw error;
    }
  },

  signUp: async (email, password, username) => {
    try {
      set({ loading: true });
      const userProfile = await AuthService.registerWithEmail(email, password, username);
      set({ user: userProfile, loading: false });
    } catch (error: any) {
      set({ loading: false });
      if (DEBUG_LOGS) console.error('sign up error:', error);
      throw error;
    }
  },

  signInWithGoogle: async () => {
    try {
      set({ loading: true });
      const userProfile = await AuthService.signInWithGooglePopup();
      set({ user: userProfile, loading: false });
    } catch (error: any) {
      if (DEBUG_LOGS) console.error('google sign in error:', error);
      set({ loading: false });
      throw error;
    }
  },

  signOut: async () => {
    try {
      set({ loading: true });
      await AuthService.signOut();
      set({ user: null, loading: false });
      
      const { useCollaborationStore } = require('./useCollaborationStore');
      useCollaborationStore.setState({ 
        favorites: [],
        userCollaboration: null
      });
    } catch (error: any) {
      set({ loading: false });
      if (DEBUG_LOGS) console.error('sign out error:', error);
      throw error;
    }
  },

  resetPassword: async (email) => {
    try {
      await AuthService.resetPassword(email);
    } catch (error: any) {
      if (DEBUG_LOGS) console.error('password reset error:', error);
      throw error;
    }
  },

  initializeAuth: () => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      if (firebaseUser) {
        const userProfile = await AuthService.getUserProfile(firebaseUser.uid);
        set({ user: userProfile, loading: false });
        
        const { useCollaborationStore } = require('./useCollaborationStore');
        const collaborations = await require('../services').UserService.getUserCollaborations(firebaseUser.uid);
        useCollaborationStore.setState({ 
          userCollaborations: collaborations,
          userCollaboration: null,
          favorites: []
        });
      } else {
        set({ user: null, loading: false });
      }
    });
    return unsubscribe;
  }
}));
