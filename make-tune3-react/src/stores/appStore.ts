import { create } from 'zustand';
import type { User } from '../types/auth';
import type { AudioEngine } from '../audio-services/audio-engine';
import type { AudioState } from '../types';
import type { 
  Project, 
  Track, 
  UserCollaboration, 
  CollaborationData,
  TrackId,
  ProjectId 
} from '../types/collaboration';
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

// Properly structured store interface
interface AppState {
  // Auth Slice
  auth: {
    user: User | null;
    loading: boolean;
    signIn: (email: string, password: string) => Promise<void>;
    signUp: (email: string, password: string) => Promise<void>;
    signOut: () => Promise<void>;
    resetPassword: (email: string) => Promise<void>;
    initializeAuth: () => (() => void);
  };

  // Audio Engine Slice
  audio: {
    engine: AudioEngine | null;
    state: AudioState | null;
    setEngine: (engine: AudioEngine) => void;
    setState: (state: AudioState) => void;
  };

  // Collaboration Data Slice
  collaboration: {
    currentProject: Project | null;
    userCollaboration: UserCollaboration | null;
    allTracks: Track[];
    regularTracks: Track[];
    pastStageTracks: Track[];
    backingTrack: Track | null;
    
    // Actions
    setCurrentProject: (project: Project) => void;
    setUserCollaboration: (collaboration: UserCollaboration) => void;
    setTracks: (tracks: Track[]) => void;
    markAsListened: (trackId: TrackId) => void;
    addToFavorites: (trackId: TrackId) => void;
    removeFromFavorites: (trackId: TrackId) => void;
    voteFor: (trackId: TrackId) => void;
    setListenedRatio: (ratio: number) => void;
    
    // Computed
    isTrackListened: (trackId: TrackId) => boolean;
    isTrackFavorite: (trackId: TrackId) => boolean;
    getTrackById: (trackId: TrackId) => Track | undefined;
  };

  // UI State Slice
  ui: {
    isLoading: boolean;
    showAuth: boolean;
    debug: boolean;
    setLoading: (loading: boolean) => void;
    setShowAuth: (show: boolean) => void;
    setDebug: (debug: boolean) => void;
  };

  // Playback Actions Slice
  playback: {
    handleSubmissionVolumeChange: (volume: number) => void;
    handleMasterVolumeChange: (volume: number) => void;
    handleTimeSliderChange: (value: number) => void;
    previousTrack: () => void;
    nextTrack: () => void;
    togglePlayPause: () => void;
    playSubmission: (trackId: TrackId, index: number, favorite?: boolean) => void;
    playPastSubmission: (index: number) => void;
    getCurrentTime: (state: AudioState) => string;
    getTotalTime: (state: AudioState) => string;
    getTimeSliderValue: (state: AudioState) => number;
  };
}

// Helper function to format time
const formatTime = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};

// Create the store with proper structure
export const useAppStore = create<AppState>((set, get) => ({
  // Auth Slice
  auth: {
    user: null,
    loading: true,

    signIn: async (email, password) => {
      try {
        console.log('🔐 Signing in with email:', email);
        set(state => ({ auth: { ...state.auth, loading: true } }));
        const userProfile = await AuthService.loginWithEmail(email, password);
        console.log('🔐 Sign in successful:', userProfile);
        set(state => ({ auth: { ...state.auth, user: userProfile, loading: false } }));
      } catch (error: any) {
        console.error('🔐 Sign in error:', error);
        set(state => ({ auth: { ...state.auth, loading: false } }));
        throw error;
      }
    },

    signUp: async (email, password) => {
      try {
        set(state => ({ auth: { ...state.auth, loading: true } }));
        const userProfile = await AuthService.registerWithEmail(email, password);
        set(state => ({ auth: { ...state.auth, user: userProfile, loading: false } }));
      } catch (error: any) {
        set(state => ({ auth: { ...state.auth, loading: false } }));
        console.error('🔐 Sign up error:', error);
        throw error;
      }
    },

    signOut: async () => {
      try {
        set(state => ({ auth: { ...state.auth, loading: true } }));
        await AuthService.signOut();
        set(state => ({ auth: { ...state.auth, user: null, loading: false } }));
      } catch (error: any) {
        set(state => ({ auth: { ...state.auth, loading: false } }));
        console.error('🔐 Sign out error:', error);
        throw error;
      }
    },

    resetPassword: async (email) => {
      try {
        await AuthService.resetPassword(email);
      } catch (error: any) {
        console.error('🔐 Password reset error:', error);
        throw error;
      }
    },

    initializeAuth: () => {
      console.log('🔐 Initializing auth...');
      const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
        console.log('🔐 Auth state changed:', firebaseUser ? firebaseUser.email : 'null');
        if (firebaseUser) {
          try {
            console.log('🔐 Fetching user profile for:', firebaseUser.uid);
            const userProfile = await AuthService.getUserProfile(firebaseUser.uid);
            console.log('🔐 User profile fetched:', userProfile);
            set(state => ({ auth: { ...state.auth, user: userProfile, loading: false } }));
          } catch (error) {
            console.error('🔐 Error fetching user profile:', error);
            set(state => ({ auth: { ...state.auth, user: null, loading: false } }));
          }
        } else {
          console.log('🔐 No user, setting loading to false');
          set(state => ({ auth: { ...state.auth, user: null, loading: false } }));
        }
      });
      return unsubscribe;
    }
  },

  // Audio Slice
  audio: {
    engine: null,
    state: null,

    setEngine: (engine) => set(state => ({ audio: { ...state.audio, engine } })),

    setState: (audioState) => set(state => ({ audio: { ...state.audio, state: audioState } }))
  },

  // Collaboration Slice
  collaboration: {
    currentProject: null,
    userCollaboration: null,
    allTracks: [
      {
        id: 'track1',
        title: 'Phone from China',
        artist: 'Demo Artist',
        filePath: '/test-audio/df9a07de-d40c-4e49-ab35-2c94f55e5137_phone%20from%20china.mp3',
        duration: 240,
        createdAt: new Date() as any,
        projectId: 'project1'
      },
      {
        id: 'track2',
        title: 'Voiceover 2',
        artist: 'Demo Artist',
        filePath: '/test-audio/voiceover2.mp3',
        duration: 180,
        createdAt: new Date() as any,
        projectId: 'project1'
      },
      {
        id: 'track3',
        title: 'Fuck Me Up',
        artist: 'Demo Artist',
        filePath: '/test-audio/fuck_me_upppp_mh2bywZ.mp3',
        duration: 200,
        createdAt: new Date() as any,
        projectId: 'project1'
      },
      {
        id: 'track4',
        title: 'BB G Ab',
        artist: 'Demo Artist',
        filePath: '/test-audio/bb_g_Ab.mp3',
        duration: 220,
        createdAt: new Date() as any,
        projectId: 'project1'
      }
    ],
    regularTracks: [
      {
        id: 'track1',
        title: 'Phone from China',
        artist: 'Demo Artist',
        filePath: '/test-audio/df9a07de-d40c-4e49-ab35-2c94f55e5137_phone%20from%20china.mp3',
        duration: 240,
        createdAt: new Date() as any,
        projectId: 'project1'
      },
      {
        id: 'track2',
        title: 'Voiceover 2',
        artist: 'Demo Artist',
        filePath: '/test-audio/voiceover2.mp3',
        duration: 180,
        createdAt: new Date() as any,
        projectId: 'project1'
      },
      {
        id: 'track3',
        title: 'Fuck Me Up',
        artist: 'Demo Artist',
        filePath: '/test-audio/fuck_me_upppp_mh2bywZ.mp3',
        duration: 200,
        createdAt: new Date() as any,
        projectId: 'project1'
      },
      {
        id: 'track4',
        title: 'BB G Ab',
        artist: 'Demo Artist',
        filePath: '/test-audio/bb_g_Ab.mp3',
        duration: 220,
        createdAt: new Date() as any,
        projectId: 'project1'
      }
    ],
    pastStageTracks: [
      {
        id: 'past1',
        title: 'Rudi Demo Arr1',
        artist: 'Demo Artist',
        filePath: '/test-audio/Rudi%20demo%20arr1%20acc%20copy.mp3',
        duration: 240,
        createdAt: new Date() as any,
        projectId: 'project1'
      },
      {
        id: 'past2',
        title: 'Kuba',
        artist: 'Demo Artist',
        filePath: '/test-audio/Kuba.mp3',
        duration: 180,
        createdAt: new Date() as any,
        projectId: 'project1'
      },
      {
        id: 'past3',
        title: 'Tomas Demo1',
        artist: 'Demo Artist',
        filePath: '/test-audio/tomas%20demo1%20instrumental.mp3',
        duration: 200,
        createdAt: new Date() as any,
        projectId: 'project1'
      }
    ],
    backingTrack: {
      id: 'backing1',
      title: 'Demo 2 Instrumental',
      artist: 'Demo Artist',
      filePath: '/test-audio/demo2%20instrumental.mp3',
      duration: 240,
      createdAt: new Date() as any,
      projectId: 'project1'
    },

    setCurrentProject: (project) => set(state => ({ 
      collaboration: { ...state.collaboration, currentProject: project } 
    })),

    setUserCollaboration: (collaboration) => set(state => ({ 
      collaboration: { ...state.collaboration, userCollaboration: collaboration } 
    })),

    setTracks: (tracks) => {
      const { userCollaboration } = get().collaboration;
      const favoriteTrackIds = userCollaboration?.favoriteTracks || [];
      
      const regularTracks = tracks.filter(track => 
        !favoriteTrackIds.includes(track.id)
      );
      
      set(state => ({ 
        collaboration: { 
          ...state.collaboration, 
          allTracks: tracks, 
          regularTracks 
        } 
      }));
    },

    markAsListened: (trackId) => {
      const { userCollaboration } = get().collaboration;
      if (!userCollaboration) return;

      const listenedTracks = [...userCollaboration.listenedTracks];
      if (!listenedTracks.includes(trackId)) {
        listenedTracks.push(trackId);
        set(state => ({
          collaboration: {
            ...state.collaboration,
            userCollaboration: {
              ...state.collaboration.userCollaboration!,
              listenedTracks,
              lastInteraction: new Date() as any
            }
          }
        }));
      }
    },

    addToFavorites: (trackId) => {
      const { userCollaboration, allTracks } = get().collaboration;
      if (!userCollaboration) return;

      const favoriteTracks = [...userCollaboration.favoriteTracks];
      if (!favoriteTracks.includes(trackId)) {
        favoriteTracks.push(trackId);
        
        const regularTracks = allTracks.filter(track => 
          !favoriteTracks.includes(track.id)
        );

        set(state => ({
          collaboration: {
            ...state.collaboration,
            userCollaboration: {
              ...state.collaboration.userCollaboration!,
              favoriteTracks,
              lastInteraction: new Date() as any
            },
            regularTracks
          }
        }));
      }
    },

    removeFromFavorites: (trackId) => {
      const { userCollaboration, allTracks } = get().collaboration;
      if (!userCollaboration) return;

      const favoriteTracks = userCollaboration.favoriteTracks.filter(id => id !== trackId);
      const regularTracks = allTracks.filter(track => 
        !favoriteTracks.includes(track.id)
      );

      set(state => ({
        collaboration: {
          ...state.collaboration,
          userCollaboration: {
            ...state.collaboration.userCollaboration!,
            favoriteTracks,
            lastInteraction: new Date() as any
          },
          regularTracks
        }
      }));
    },

    voteFor: (trackId) => {
      const { userCollaboration } = get().collaboration;
      if (!userCollaboration) return;

      set(state => ({
        collaboration: {
          ...state.collaboration,
          userCollaboration: {
            ...state.collaboration.userCollaboration!,
            finalVote: trackId,
            lastInteraction: new Date() as any
          }
        }
      }));
    },

    setListenedRatio: (ratio) => {
      const { userCollaboration } = get().collaboration;
      if (!userCollaboration) return;

      set(state => ({
        collaboration: {
          ...state.collaboration,
          userCollaboration: {
            ...state.collaboration.userCollaboration!,
            listenedRatio: ratio
          }
        }
      }));
    },

    isTrackListened: (trackId) => {
      const { userCollaboration } = get().collaboration;
      return userCollaboration?.listenedTracks.includes(trackId) || false;
    },

    isTrackFavorite: (trackId) => {
      const { userCollaboration } = get().collaboration;
      return userCollaboration?.favoriteTracks.includes(trackId) || false;
    },

    getTrackById: (trackId) => {
      const { allTracks } = get().collaboration;
      return allTracks.find(track => track.id === trackId);
    }
  },

  // UI Slice
  ui: {
    isLoading: true,
    showAuth: false,
    debug: false,

    setLoading: (loading) => set(state => ({ ui: { ...state.ui, isLoading: loading } })),
    setShowAuth: (show) => set(state => ({ ui: { ...state.ui, showAuth: show } })),
    setDebug: (debug) => set(state => ({ ui: { ...state.ui, debug } }))
  },

  // Playback Slice
  playback: {
    handleSubmissionVolumeChange: (volume) => {
      const engine = get().audio.engine;
      if (engine) {
        engine.setVolume(1, volume);
      }
    },

    handleMasterVolumeChange: (volume) => {
      const engine = get().audio.engine;
      if (engine) {
        engine.setMasterVolume(volume);
      }
    },

    handleTimeSliderChange: (value) => {
      const engine = get().audio.engine;
      const state = get().audio.state;
      if (!engine || !state) return;

      const pastStagePlayback = state.playerController.pastStagePlayback;
      const duration = pastStagePlayback ? state.player2.duration : state.player1.duration;
      if (duration > 0) {
        const newTime = (value / 100) * duration;
        engine.seek(newTime, pastStagePlayback);
      }
    },

    previousTrack: () => {
      const engine = get().audio.engine;
      const state = get().audio.state;
      const { regularTracks, pastStageTracks, backingTrack, isTrackFavorite } = get().collaboration;
      
      if (!engine || !state) return;

      const pastStagePlayback = state.playerController.pastStagePlayback;
      const playingFavourite = state.playerController.playingFavourite;
      const currentTrackIndex = state.playerController.currentTrackId;

      if (pastStagePlayback) {
        if (currentTrackIndex > 0) {
          const track = pastStageTracks[currentTrackIndex - 1];
          engine.playPastStage(track.filePath, currentTrackIndex - 1);
        }
      } else if (playingFavourite) {
        const favoriteTracks = regularTracks.filter(track => isTrackFavorite(track.id));
        if (currentTrackIndex > 0 && currentTrackIndex < favoriteTracks.length) {
          const track = favoriteTracks[currentTrackIndex - 1];
          engine.setPlayingFavourite(true);
          engine.playSubmission(track.filePath, backingTrack?.filePath || '', currentTrackIndex - 1);
        }
      } else {
        if (currentTrackIndex > 0) {
          const track = regularTracks[currentTrackIndex - 1];
          engine.setPlayingFavourite(false);
          engine.playSubmission(track.filePath, backingTrack?.filePath || '', currentTrackIndex - 1);
        }
      }
    },

    nextTrack: () => {
      const engine = get().audio.engine;
      const state = get().audio.state;
      const { regularTracks, pastStageTracks, backingTrack, isTrackFavorite } = get().collaboration;
      
      if (!engine || !state) return;

      const pastStagePlayback = state.playerController.pastStagePlayback;
      const playingFavourite = state.playerController.playingFavourite;
      const currentTrackIndex = state.playerController.currentTrackId;

      if (pastStagePlayback) {
        if (currentTrackIndex < pastStageTracks.length - 1) {
          const track = pastStageTracks[currentTrackIndex + 1];
          engine.playPastStage(track.filePath, currentTrackIndex + 1);
        }
      } else if (playingFavourite) {
        const favoriteTracks = regularTracks.filter(track => isTrackFavorite(track.id));
        if (currentTrackIndex < favoriteTracks.length - 1) {
          const track = favoriteTracks[currentTrackIndex + 1];
          engine.setPlayingFavourite(true);
          engine.playSubmission(track.filePath, backingTrack?.filePath || '', currentTrackIndex + 1);
        }
      } else {
        if (currentTrackIndex < regularTracks.length - 1) {
          const track = regularTracks[currentTrackIndex + 1];
          engine.setPlayingFavourite(false);
          engine.playSubmission(track.filePath, backingTrack?.filePath || '', currentTrackIndex + 1);
        }
      }
    },

    togglePlayPause: () => {
      const engine = get().audio.engine;
      if (engine) {
        engine.togglePlayback();
      }
    },

    playSubmission: (trackId, index, favorite) => {
      const engine = get().audio.engine;
      const { backingTrack } = get().collaboration;
      const track = get().collaboration.getTrackById(trackId);
      
      if (!engine || !track) return;

      if (favorite !== null && favorite !== undefined) {
        engine.setPlayingFavourite(favorite);
      }
      
      engine.playSubmission(track.filePath, backingTrack?.filePath || '', index);
    },

    playPastSubmission: (index) => {
      const engine = get().audio.engine;
      const { pastStageTracks } = get().collaboration;
      
      if (!engine || !pastStageTracks[index]) return;

      engine.playPastStage(pastStageTracks[index].filePath, index);
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
  }
})); 