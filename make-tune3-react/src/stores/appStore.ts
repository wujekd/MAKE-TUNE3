import { create } from 'zustand';
import type { User } from '../types/auth';
import type { AudioEngine } from '../audio-services/audio-engine';
import type { AudioState } from '../types';

// debug flag for console logs
const DEBUG_LOGS = true;
import type { 
  Project, 
  Collaboration,
  Track, 
  UserCollaboration,
  SubmissionEntry,
  SubmissionSettings
} from '../types/collaboration';

import { 
  onAuthStateChanged
} from 'firebase/auth';
import type { User as FirebaseUser } from 'firebase/auth';
import { auth } from '../services/firebase';
import { AuthService } from '../services/authService';
import { CollaborationService } from '../services/collaborationService';
import { storage } from '../services/firebase';
import { ref, getDownloadURL } from 'firebase/storage';

// store interface
interface AppState {
  // Auth Slice
  auth: {
    user: User | null;
    loading: boolean;
    signIn: (email: string, password: string) => Promise<void>;
    signUp: (email: string, password: string) => Promise<void>;
    signOut: () => Promise<void>;
    resetPassword: (email: string) => Promise<void>;
    signInWithGoogle: () => Promise<void>;
    initializeAuth: () => (() => void);
  };

  // audio engine slice
  audio: {
    engine: AudioEngine | null;
    state: AudioState | null;
    setEngine: (engine: AudioEngine) => void;
    setState: (state: AudioState) => void;
  };

  // collaboration data slice
  collaboration: {
    currentProject: Project | null;
    currentCollaboration: Collaboration | null;
    userCollaboration: UserCollaboration | null;
    userCollaborations: Collaboration[]; // user's collaborations
    
    // track data from file paths
    allTracks: Track[];
    regularTracks: Track[];
    pastStageTracks: Track[];
    backingTrack: Track | null;
    
    // favorites array
    favorites: Track[];
    
    // loading states
    isLoadingCollaboration: boolean;
    isLoadingProject: boolean;
    isUpdatingFavorites: boolean;
    isUpdatingListened: boolean;
    
    // actions
    setCurrentProject: (project: Project) => void;
    setCurrentCollaboration: (collaboration: Collaboration) => void;
    setUserCollaboration: (collaboration: UserCollaboration) => void;
    setUserCollaborations: (collaborations: Collaboration[]) => void;
    setTracks: (tracks: { filePath: string }[]) => void;
    markAsListened: (filePath: string) => Promise<void>;
    addToFavorites: (filePath: string) => Promise<void>;
    removeFromFavorites: (filePath: string) => Promise<void>;
    voteFor: (filePath: string) => void;
    setListenedRatio: (ratio: number) => void;
    loadUserCollaborations: (userId: string) => Promise<void>;
    loadCollaboration: (userId: string, collaborationId: string) => Promise<void>;
    loadCollaborationAnonymous: () => Promise<void>;
    loadCollaborationAnonymousById: (collaborationId: string) => Promise<void>;
    loadProject: (projectId: string) => Promise<void>;
    
    // computed
    isTrackListened: (filePath: string) => boolean;
    isTrackFavorite: (filePath: string) => boolean;
    getTrackByFilePath: (filePath: string) => Track | undefined;
    // moderation
    approveSubmission?: (filePath: string) => Promise<void>;
    rejectSubmission?: (filePath: string) => Promise<void>;
  };

  // ui state slice
  ui: {
    isLoading: boolean;
    showAuth: boolean;
    debug: boolean;
    setLoading: (loading: boolean) => void;
    setShowAuth: (show: boolean) => void;
    setDebug: (debug: boolean) => void;
  };

  // playback actions slice
  playback: {
    handleSubmissionVolumeChange: (volume: number) => void;
    handleMasterVolumeChange: (volume: number) => void;
    handleTimeSliderChange: (value: number) => void;
    previousTrack: () => void;
    nextTrack: () => void;
    togglePlayPause: () => void;
    playSubmission: (filePath: string, index: number, favorite?: boolean) => void;
    playPastSubmission: (index: number) => void;
    getCurrentTime: (state: AudioState) => string;
    getTotalTime: (state: AudioState) => string;
    getTimeSliderValue: (state: AudioState) => number;
  };
}

// format time helper
const formatTime = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};

// create track from file path
const createTrackFromFilePath = (filePath: string, category: 'backing' | 'submission' | 'pastStage', collaborationId: string, settings?: SubmissionSettings, optimizedPath?: string): Track => {
  const fileName = filePath.split('/').pop() || filePath;
      const title = fileName.replace(/\.[^/.]+$/, ''); // remove extension
  
  return {
    id: filePath, // use filePath as id
    title,
    filePath,
    optimizedPath,
    duration: 0, // set by audioengine
    createdAt: new Date() as any, // set when real data available
    collaborationId,
    category,
    approved: true, // default approved
    submissionSettings: settings
  };
};

// resolve audio src helper
const urlCache = new Map<string, string>();
const resolveAudioUrl = async (path: string): Promise<string> => {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  if (path.startsWith('/test-audio/')) return path;
  if (!path.startsWith('collabs/')) return `/test-audio/${path}`;
  const cached = urlCache.get(path);
  if (cached) return cached;
  const url = await getDownloadURL(ref(storage, path));
  urlCache.set(path, url);
  return url;
};

// update regular tracks based on favorites
const updateRegularTracks = (allTracks: Track[], favoriteFilePaths: string[]) => {
  return allTracks.filter(track => !favoriteFilePaths.includes(track.filePath));
};

// create store
export const useAppStore = create<AppState>((set, get) => ({
  // auth slice
  auth: {
    user: null,
    loading: true,

    signIn: async (email, password) => {
      try {
        if (DEBUG_LOGS) console.log('signing in with email:', email);
        set(state => ({ auth: { ...state.auth, loading: true } }));
        const userProfile = await AuthService.loginWithEmail(email, password);
        if (DEBUG_LOGS) console.log('sign in successful:', userProfile);
        set(state => ({ auth: { ...state.auth, user: userProfile, loading: false } }));
      } catch (error: any) {
        if (DEBUG_LOGS) console.error('sign in error:', error);
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
        if (DEBUG_LOGS) console.error('sign up error:', error);
        throw error;
      }
    },

    signInWithGoogle: async () => {
      try {
        set(state => ({ auth: { ...state.auth, loading: true } }));
        const userProfile = await AuthService.signInWithGooglePopup();
        set(state => ({ auth: { ...state.auth, user: userProfile, loading: false } }));
      } catch (error: any) {
        if (DEBUG_LOGS) console.error('google sign in error:', error);
        set(state => ({ auth: { ...state.auth, loading: false } }));
        throw error;
      }
    },

    signOut: async () => {
      try {
        set(state => ({ auth: { ...state.auth, loading: true } }));
        await AuthService.signOut();
        set(state => ({ 
          auth: { ...state.auth, user: null, loading: false },
          collaboration: { 
            ...state.collaboration, 
            favorites: [],
            userCollaboration: null
          }
        }));
      } catch (error: any) {
        set(state => ({ auth: { ...state.auth, loading: false } }));
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
      if (DEBUG_LOGS) console.log('initializing auth...');
      const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
        if (DEBUG_LOGS) console.log('auth state changed:', firebaseUser ? firebaseUser.email : 'null');
        if (firebaseUser) {
          try {
            if (DEBUG_LOGS) console.log('fetching user profile for:', firebaseUser.uid);
            const userProfile = await AuthService.getUserProfile(firebaseUser.uid);
            if (DEBUG_LOGS) console.log('user profile fetched:', userProfile);
            
            // Load user's collaborations
            const collaborations = await CollaborationService.getUserCollaborations(firebaseUser.uid);
            if (DEBUG_LOGS) console.log('user collaborations loaded:', collaborations);
            
            set(state => ({ 
              auth: { ...state.auth, user: userProfile, loading: false },
              collaboration: { 
                ...state.collaboration, 
                userCollaborations: collaborations,
                userCollaboration: null, // will be set when user selects a collaboration
                // clear favorites when user logs in
                favorites: []
              }
            }));
          } catch (error) {
            if (DEBUG_LOGS) console.error('error fetching user profile:', error);
            set(state => ({ auth: { ...state.auth, user: null, loading: false } }));
          }
        } else {
          if (DEBUG_LOGS) console.log('no user, setting loading to false');
          set(state => ({ 
            auth: { ...state.auth, user: null, loading: false },
            collaboration: { 
              ...state.collaboration, 
              userCollaboration: null,
              userCollaborations: [],
              favorites: []
            }
          }));
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
    currentCollaboration: null,
    userCollaboration: null,
    userCollaborations: [],
    allTracks: [],
    regularTracks: [],
    pastStageTracks: [],
    backingTrack: null,
    favorites: [],
    isLoadingCollaboration: false,
    isLoadingProject: false,
    isUpdatingFavorites: false,
    isUpdatingListened: false,

    setCurrentProject: (project) => set(state => ({ 
      collaboration: { ...state.collaboration, currentProject: project } 
    })),

    setCurrentCollaboration: (collaboration) => set(state => ({ 
      collaboration: { ...state.collaboration, currentCollaboration: collaboration } 
    })),

    setUserCollaboration: (collaboration) => set(state => ({ 
      collaboration: { ...state.collaboration, userCollaboration: collaboration } 
    })),

    setUserCollaborations: (collaborations) => set(state => ({ 
      collaboration: { ...state.collaboration, userCollaborations: collaborations } 
    })),

    setTracks: (tracks) => {
      const { userCollaboration } = get().collaboration;
      const favoriteFilePaths = userCollaboration?.favoriteTracks || [];
      
      // Convert file paths to Track objects
      const trackObjects = tracks.map(track => 
        createTrackFromFilePath(track.filePath, 'submission', get().collaboration.currentCollaboration?.id || '')
      );
      
      // For now, all tracks are considered regular submissions
      // Later we'll implement filtering based on user data
      const regularTracks = trackObjects.filter(track => 
        !favoriteFilePaths.includes(track.filePath)
      );
      
      // Past stage tracks will be loaded from project data later
      const pastStageTracks: Track[] = [];
      
      // Backing track will be set separately from collaboration data
      const backingTrack: Track | null = null;
      
      set(state => ({ 
        collaboration: { 
          ...state.collaboration, 
          allTracks: trackObjects, 
          regularTracks,
          pastStageTracks,
          backingTrack
        } 
      }));
    },

    loadCollaboration: async (userId: string, collaborationId: string) => {
      try {
        if (DEBUG_LOGS) console.log('loading collaboration data for:', collaborationId);
        set(state => ({ collaboration: { ...state.collaboration, isLoadingCollaboration: true } }));
        
        const collaborationData = await CollaborationService.loadCollaborationData(userId, collaborationId);
        if (DEBUG_LOGS) console.log('loaded collaboration.submissions:', collaborationData.collaboration?.submissions);
        
        // Construct track objects from file paths
        const submissionTracks = (collaborationData.collaboration.submissions && collaborationData.collaboration.submissions.length > 0)
          ? collaborationData.collaboration.submissions.map((s: SubmissionEntry) => {
              if (DEBUG_LOGS) console.log('tracks from submissions[]', s);
              return createTrackFromFilePath(s.path, 'submission', collaborationData.collaboration.id, s.settings, s.optimizedPath);
            })
          : (collaborationData.collaboration as any).submissionPaths?.map((path: string) => {
              if (DEBUG_LOGS) console.log('tracks from legacy submissionPaths[]', path);
              return createTrackFromFilePath(path, 'submission', collaborationData.collaboration.id);
            }) || [];
        const backingTrack = collaborationData.collaboration.backingTrackPath ? 
          createTrackFromFilePath(collaborationData.collaboration.backingTrackPath, 'backing', collaborationData.collaboration.id) : null;
        
        // calculate favorites and regular tracks
        const favoriteFilePaths = collaborationData.userCollaboration?.favoriteTracks || [];
        const favorites = submissionTracks.filter((track: Track) => 
          favoriteFilePaths.includes(track.filePath)
        );
        const regularTracks = submissionTracks.filter((track: Track) => 
          !favoriteFilePaths.includes(track.filePath)
        );
        
        set(state => ({
          collaboration: {
            ...state.collaboration,
            currentCollaboration: collaborationData.collaboration,
            userCollaboration: collaborationData.userCollaboration,
            allTracks: submissionTracks,
            regularTracks,
            favorites,
            pastStageTracks: [], // will be loaded from project data later
            backingTrack,
            isLoadingCollaboration: false
          }
        }));
        
        // Load project data in background
        if (collaborationData.collaboration.projectId) {
          get().collaboration.loadProject(collaborationData.collaboration.projectId);
        }
        
        if (DEBUG_LOGS) console.log('collaboration data loaded successfully');
      } catch (error) {
        if (DEBUG_LOGS) console.error('error loading collaboration data:', error);
        set(state => ({ collaboration: { ...state.collaboration, isLoadingCollaboration: false } }));
      }
    },

    loadCollaborationAnonymous: async () => {
      try {
        if (DEBUG_LOGS) console.log('loading collaboration data for anonymous user');
        set(state => ({ collaboration: { ...state.collaboration, isLoadingCollaboration: true } }));
        
        // Get the first available collaboration
        const collaboration = await CollaborationService.getFirstCollaboration();
        if (!collaboration) {
          throw new Error('No collaborations found');
        }
        
        const collaborationData = await CollaborationService.loadCollaborationDataAnonymous(collaboration.id);
        if (DEBUG_LOGS) console.log('loaded (anon) collaboration.submissions:', collaborationData.collaboration?.submissions);
        
        // Construct track objects from file paths
        const submissionTracks = (collaborationData.collaboration.submissions && collaborationData.collaboration.submissions.length > 0)
          ? collaborationData.collaboration.submissions.map((s: SubmissionEntry) => {
              if (DEBUG_LOGS) console.log('tracks from submissions[] (anon)', s);
              return createTrackFromFilePath(s.path, 'submission', collaborationData.collaboration.id, s.settings, s.optimizedPath);
            })
          : (collaborationData.collaboration as any).submissionPaths?.map((path: string) => {
              if (DEBUG_LOGS) console.log('tracks from legacy submissionPaths[] (anon)', path);
              return createTrackFromFilePath(path, 'submission', collaborationData.collaboration.id);
            }) || [];
        const backingTrack = collaborationData.collaboration.backingTrackPath ? 
          createTrackFromFilePath(collaborationData.collaboration.backingTrackPath, 'backing', collaborationData.collaboration.id) : null;
        
        // For anonymous users, all tracks are regular tracks (no favorites)
        const regularTracks = submissionTracks;
        
        set(state => ({
          collaboration: {
            ...state.collaboration,
            currentCollaboration: collaborationData.collaboration,
            userCollaboration: null, // No user-specific data for anonymous users
            allTracks: submissionTracks,
            regularTracks,
            pastStageTracks: [], // Will be loaded from project data later
            backingTrack,
            isLoadingCollaboration: false
          }
        }));
        
        // Load project data in background
        if (collaborationData.collaboration.projectId) {
          get().collaboration.loadProject(collaborationData.collaboration.projectId);
        }
        
        if (DEBUG_LOGS) console.log('collaboration data loaded successfully for anonymous user');
      } catch (error) {
        if (DEBUG_LOGS) console.error('error loading collaboration data for anonymous user:', error);
        set(state => ({ collaboration: { ...state.collaboration, isLoadingCollaboration: false } }));
      }
    },

    loadCollaborationAnonymousById: async (collaborationId: string) => {
      try {
        if (DEBUG_LOGS) console.log('loading collaboration data for anonymous user by id');
        set(state => ({ collaboration: { ...state.collaboration, isLoadingCollaboration: true } }));
        const collaborationData = await CollaborationService.loadCollaborationDataAnonymous(collaborationId);
        if (DEBUG_LOGS) console.log('loaded (anon by id) collaboration.submissions:', collaborationData.collaboration?.submissions);
        const submissionTracks = (collaborationData.collaboration.submissions && collaborationData.collaboration.submissions.length > 0)
          ? collaborationData.collaboration.submissions.map((s: SubmissionEntry) => {
              if (DEBUG_LOGS) console.log('tracks from submissions[] (anon by id)', s);
              return createTrackFromFilePath(s.path, 'submission', collaborationData.collaboration.id, s.settings, s.optimizedPath);
            })
          : (collaborationData.collaboration as any).submissionPaths?.map((path: string) => {
              if (DEBUG_LOGS) console.log('tracks from legacy submissionPaths[] (anon by id)', path);
              return createTrackFromFilePath(path, 'submission', collaborationData.collaboration.id);
            }) || [];
        const backingTrack = collaborationData.collaboration.backingTrackPath ? 
          createTrackFromFilePath(collaborationData.collaboration.backingTrackPath, 'backing', collaborationData.collaboration.id) : null;
        const regularTracks = submissionTracks;
        set(state => ({
          collaboration: {
            ...state.collaboration,
            currentCollaboration: collaborationData.collaboration,
            userCollaboration: null,
            allTracks: submissionTracks,
            regularTracks,
            pastStageTracks: [],
            backingTrack,
            isLoadingCollaboration: false
          }
        }));
        if (collaborationData.collaboration.projectId) {
          get().collaboration.loadProject(collaborationData.collaboration.projectId);
        }
      } catch (error) {
        if (DEBUG_LOGS) console.error('error loading anonymous collab by id:', error);
        set(state => ({ collaboration: { ...state.collaboration, isLoadingCollaboration: false } }));
      }
    },

    loadProject: async (projectId: string) => {
      try {
        if (DEBUG_LOGS) console.log('loading project data for:', projectId);
        set(state => ({ collaboration: { ...state.collaboration, isLoadingProject: true } }));
        
        const project = await CollaborationService.getProject(projectId);
        
        if (project) {
          // Extract past stage tracks from project.pastCollaborations
          const pastStageTracks = project.pastCollaborations.map(pastCollab => 
            createTrackFromFilePath(pastCollab.pastStageTrackPath, 'pastStage', pastCollab.collaborationId)
          );
          
          set(state => ({
            collaboration: {
              ...state.collaboration,
              currentProject: project,
              pastStageTracks,
              isLoadingProject: false
            }
          }));
          
          if (DEBUG_LOGS) console.log('project data loaded successfully');
        }
      } catch (error) {
        if (DEBUG_LOGS) console.error('error loading project data:', error);
        set(state => ({ collaboration: { ...state.collaboration, isLoadingProject: false } }));
      }
    },

    markAsListened: async (filePath) => {
      if (DEBUG_LOGS) console.log('markAsListened called with filePath:', filePath);
      const { user } = get().auth;
      const { currentCollaboration } = get().collaboration;
      
      if (!user) {
        // anonymous users can't mark as listened
        if (DEBUG_LOGS) console.log('anonymous user - cannot mark as listened');
        return;
      }
      
      // authenticated: pessimistic firebase approach
      if (!currentCollaboration) {
        if (DEBUG_LOGS) console.log('no collaboration loaded, returning');
        return;
      }

      try {
        if (DEBUG_LOGS) console.log('authenticated user - marking as listened in firebase');
        set(state => ({ collaboration: { ...state.collaboration, isUpdatingListened: true } }));
        
        // firebase call first
        await CollaborationService.markTrackAsListened(user.uid, currentCollaboration.id, filePath);
        
        // update local state only after firebase success
        const { userCollaboration } = get().collaboration;
        const updatedListenedTracks = [...(userCollaboration?.listenedTracks || []), filePath];
        
        set(state => ({
          collaboration: {
            ...state.collaboration,
            userCollaboration: {
              ...state.collaboration.userCollaboration!,
              listenedTracks: updatedListenedTracks,
              lastInteraction: new Date() as any
            },
            isUpdatingListened: false
          }
        }));
        if (DEBUG_LOGS) console.log('track marked as listened in firebase successfully');
      } catch (error) {
        if (DEBUG_LOGS) console.error('failed to mark as listened in firebase:', error);
        set(state => ({ collaboration: { ...state.collaboration, isUpdatingListened: false } }));
      }
    },

    addToFavorites: async (filePath) => {
      if (DEBUG_LOGS) console.log('addToFavorites called with filePath:', filePath);
      const { user } = get().auth;
      const { currentCollaboration } = get().collaboration;
      const { engine, state: audioState } = get().audio;
      
      if (DEBUG_LOGS) console.log('user status:', user ? 'authenticated' : 'anonymous');
      if (DEBUG_LOGS) console.log('current collaboration:', currentCollaboration?.id);
      
      if (!user) {
        // anonymous users can't add to favorites
        if (DEBUG_LOGS) console.log('anonymous user - cannot add to favorites');
        return;
      }
        
        // authenticated: pessimistic firebase approach
        if (!currentCollaboration) {
          if (DEBUG_LOGS) console.log('no collaboration loaded, returning');
          return;
        }

        try {
          if (DEBUG_LOGS) console.log('authenticated user - adding to firebase favorites');
          set(state => ({ collaboration: { ...state.collaboration, isUpdatingFavorites: true } }));
          
          // firebase call first
          if (DEBUG_LOGS) console.log('calling firebase addTrackToFavorites...');
          await CollaborationService.addTrackToFavorites(user.uid, currentCollaboration.id, filePath);
          if (DEBUG_LOGS) console.log('firebase call successful');
          
          // update local state only after firebase success
          const { userCollaboration } = get().collaboration;
          const updatedFavorites = [...(userCollaboration?.favoriteTracks || []), filePath];
          if (DEBUG_LOGS) console.log('updated favorites array:', updatedFavorites);
          
          // update favorites array
          const track = get().collaboration.getTrackByFilePath(filePath);
          const updatedFavoritesArray = track ? [...get().collaboration.favorites, track] : get().collaboration.favorites;
          
          set(state => ({
            collaboration: {
              ...state.collaboration,
              userCollaboration: {
                ...state.collaboration.userCollaboration!,
                favoriteTracks: updatedFavorites,
                lastInteraction: new Date() as any
              },
              regularTracks: updateRegularTracks(state.collaboration.allTracks, updatedFavorites),
              favorites: updatedFavoritesArray,
              isUpdatingFavorites: false
            }
          }));
          
          if (DEBUG_LOGS) console.log('track added to firebase favorites successfully');

          // update playingFavourite and currentTrackId if this is the currently playing track
          if (engine && audioState) {
            const currentTrackSrc = audioState.player1.source;
            const track = get().collaboration.getTrackByFilePath(filePath);
            
            if (track && currentTrackSrc === `/test-audio/${track.filePath}`) {
              if (DEBUG_LOGS) console.log('updating playingFavourite to true for currently playing track');
              engine.setPlayingFavourite(true);
              
              // update currentTrackId to reflect the new position in favorites
              const newFavoriteIndex = get().collaboration.favorites.findIndex(t => t.filePath === track.filePath);
              if (newFavoriteIndex !== -1) {
                if (DEBUG_LOGS) console.log('updating currentTrackId to:', newFavoriteIndex);
                engine.updateCurrentTrackId(newFavoriteIndex);
              }
            }
          }
        } catch (error) {
          if (DEBUG_LOGS) console.error('failed to add to firebase favorites:', error);
          set(state => ({ collaboration: { ...state.collaboration, isUpdatingFavorites: false } }));
        }
    },

    removeFromFavorites: async (filePath) => {
      if (DEBUG_LOGS) console.log('removeFromFavorites called with filePath:', filePath);
      const { user } = get().auth;
      const { currentCollaboration } = get().collaboration;
      const { engine, state: audioState } = get().audio;
      
      if (!user) {
        // anonymous users can't remove from favorites
        if (DEBUG_LOGS) console.log('anonymous user - cannot remove from favorites');
        return;
      }
      
      // authenticated: pessimistic firebase approach
      if (!currentCollaboration) {
        if (DEBUG_LOGS) console.log('no collaboration loaded, returning');
        return;
      }

      try {
        if (DEBUG_LOGS) console.log('authenticated user - removing from firebase favorites');
        set(state => ({ collaboration: { ...state.collaboration, isUpdatingFavorites: true } }));
        
        // firebase call first
        await CollaborationService.removeTrackFromFavorites(user.uid, currentCollaboration.id, filePath);
        
        // update local state only after firebase success
        const { userCollaboration } = get().collaboration;
        const updatedFavorites = userCollaboration?.favoriteTracks.filter(path => path !== filePath) || [];
        
        // update favorites array
        const updatedFavoritesArray = get().collaboration.favorites.filter(track => track.filePath !== filePath);
        
        set(state => ({
          collaboration: {
            ...state.collaboration,
            userCollaboration: {
              ...state.collaboration.userCollaboration!,
              favoriteTracks: updatedFavorites,
              lastInteraction: new Date() as any
            },
            regularTracks: updateRegularTracks(state.collaboration.allTracks, updatedFavorites),
            favorites: updatedFavoritesArray,
            isUpdatingFavorites: false
          }
        }));
        if (DEBUG_LOGS) console.log('track removed from firebase favorites successfully');

        // update playingFavourite and currentTrackId if this is the currently playing track
        if (engine && audioState) {
          const currentTrackSrc = audioState.player1.source;
          const track = get().collaboration.getTrackByFilePath(filePath);
          
          if (track && currentTrackSrc === `/test-audio/${track.filePath}`) {
            if (DEBUG_LOGS) console.log('updating playingFavourite to false for currently playing track');
            engine.setPlayingFavourite(false);
            
            // update currentTrackId to reflect the new position in regular tracks
            const newRegularIndex = get().collaboration.regularTracks.findIndex(t => t.filePath === track.filePath);
            if (newRegularIndex !== -1) {
              if (DEBUG_LOGS) console.log('updating currentTrackId to:', newRegularIndex);
              engine.updateCurrentTrackId(newRegularIndex);
            }
          }
        }
      } catch (error) {
        if (DEBUG_LOGS) console.error('failed to remove from firebase favorites:', error);
        set(state => ({ collaboration: { ...state.collaboration, isUpdatingFavorites: false } }));
      }
    },

    voteFor: async (filePath) => {
      const { user } = get().auth;
      const { currentCollaboration } = get().collaboration;
      if (!user || !currentCollaboration) return;
      try {
        await CollaborationService.voteForTrack(user.uid, currentCollaboration.id, filePath);
        set(state => ({
          collaboration: {
            ...state.collaboration,
            userCollaboration: {
              ...state.collaboration.userCollaboration!,
              finalVote: filePath,
              lastInteraction: new Date() as any
            }
          }
        }));
      } catch (e) {
        // noop
      }
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

    isTrackListened: (filePath) => {
      const { user } = get().auth;
      const { userCollaboration } = get().collaboration;
      
      if (!user) {
        // anonymous users can't have listened tracks
        return false;
      }
      
      // authenticated: check firebase data
      return userCollaboration?.listenedTracks.includes(filePath) || false;
    },

    isTrackFavorite: (filePath) => {
      const { favorites } = get().collaboration;
      return favorites.some(track => track.filePath === filePath);
    },

    getTrackByFilePath: (filePath) => {
      const { allTracks } = get().collaboration;
      return allTracks.find(track => track.filePath === filePath);
    },

    approveSubmission: async (filePath) => {
      const collab = get().collaboration.currentCollaboration;
      if (!collab) return;
      try {
        await CollaborationService.setSubmissionApproved();
        set(state => ({
          collaboration: {
            ...state.collaboration,
            allTracks: state.collaboration.allTracks.map(t => t.filePath === filePath ? { ...t, approved: true } : t),
            regularTracks: state.collaboration.regularTracks.map(t => t.filePath === filePath ? { ...t, approved: true } : t),
            favorites: state.collaboration.favorites.map(t => t.filePath === filePath ? { ...t, approved: true } : t)
          }
        }));
      } catch {}
    },

    rejectSubmission: async (filePath) => {
      const collab = get().collaboration.currentCollaboration;
      if (!collab) return;
      try {
        await CollaborationService.setSubmissionApproved();
        set(state => ({
          collaboration: {
            ...state.collaboration,
            allTracks: state.collaboration.allTracks.map(t => t.filePath === filePath ? { ...t, approved: false } : t),
            regularTracks: state.collaboration.regularTracks.map(t => t.filePath === filePath ? { ...t, approved: false } : t),
            favorites: state.collaboration.favorites.map(t => t.filePath === filePath ? { ...t, approved: false } : t)
          }
        }));
      } catch {}
    },

    loadUserCollaborations: async (userId) => {
      try {
        const collaborations = await CollaborationService.getUserCollaborations(userId);
        set(state => ({
          collaboration: {
            ...state.collaboration,
            userCollaborations: collaborations
          }
        }));
      } catch (error) {
        if (DEBUG_LOGS) console.error('Error loading user collaborations:', error);
      }
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
      const audioState = get().audio.state;
      const { regularTracks, favorites, pastStageTracks, backingTrack } = get().collaboration;
      
      if (!engine || !audioState) return;

      const pastStagePlayback = audioState.playerController.pastStagePlayback;
      const currentTrackIndex = audioState.playerController.currentTrackId;

      if (pastStagePlayback) {
        (async () => {
          if (currentTrackIndex > 0) {
            const track = pastStageTracks[currentTrackIndex - 1];
            const src = await resolveAudioUrl(track.optimizedPath || track.filePath);
            engine.playPastStage(src, currentTrackIndex - 1);
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
      const engine = get().audio.engine;
      const audioState = get().audio.state;
      const { regularTracks, favorites, pastStageTracks, backingTrack } = get().collaboration;
      
      if (!engine || !audioState) return;

      const pastStagePlayback = audioState.playerController.pastStagePlayback;
      const currentTrackIndex = audioState.playerController.currentTrackId;

      if (pastStagePlayback) {
        (async () => {
          if (currentTrackIndex < pastStageTracks.length - 1) {
            const track = pastStageTracks[currentTrackIndex + 1];
            const src = await resolveAudioUrl(track.optimizedPath || track.filePath);
            engine.playPastStage(src, currentTrackIndex + 1);
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
      const engine = get().audio.engine;
      if (engine) {
        engine.togglePlayback();
      }
    },

    playSubmission: (filePath, index, favorite) => {
      if (DEBUG_LOGS) console.log('playSubmission called with:', { filePath, index, favorite });
      const engine = get().audio.engine;
      const audioState = get().audio.state as any;
      const { backingTrack, currentCollaboration } = get().collaboration;
      const track = get().collaboration.getTrackByFilePath(filePath);
      
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

      (async () => {
        // optimistic apply of submission settings in MainView
        const selected = track as Track;
        const settings = selected.submissionSettings;
        if (DEBUG_LOGS) console.log('applying submission settings (optimistic):', settings);
        const engineInstance = engine;
        if (settings && engineInstance) {
          // apply volume (linear)
          engineInstance.setVolume(1, settings.volume?.gain ?? 1);
          // apply EQ in one call to avoid intermediate merges
          const eq = settings.eq;
          const eqPayload: any = {
            highpass: { frequency: eq?.highpass?.frequency ?? get().audio.state?.eq.highpass.frequency ?? 20, Q: get().audio.state?.eq.highpass.Q ?? 0.7 },
            param1: { frequency: eq?.param1?.frequency ?? get().audio.state?.eq.param1.frequency, Q: eq?.param1?.Q ?? get().audio.state?.eq.param1.Q, gain: eq?.param1?.gain ?? get().audio.state?.eq.param1.gain },
            param2: { frequency: eq?.param2?.frequency ?? get().audio.state?.eq.param2.frequency, Q: eq?.param2?.Q ?? get().audio.state?.eq.param2.Q, gain: eq?.param2?.gain ?? get().audio.state?.eq.param2.gain },
            highshelf: { frequency: eq?.highshelf?.frequency ?? get().audio.state?.eq.highshelf.frequency, gain: eq?.highshelf?.gain ?? get().audio.state?.eq.highshelf.gain }
          };
          if (DEBUG_LOGS) console.log('eq before apply:', get().audio.state?.eq, 'payload:', eqPayload);
          engineInstance.setEq(eqPayload);
          if (DEBUG_LOGS) console.log('eq after apply (state):', get().audio.state?.eq, 'p1 volume:', get().audio.state?.player1.volume);
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
      const engine = get().audio.engine;
      const { pastStageTracks } = get().collaboration;
      
      if (!engine || !pastStageTracks[index]) return;

      (async () => {
        const src = await resolveAudioUrl(pastStageTracks[index].filePath);
        engine.playPastStage(src, index);
      })();
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