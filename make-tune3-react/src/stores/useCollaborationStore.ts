import { create } from 'zustand';
import type { 
  Project, 
  Collaboration,
  Track, 
  UserCollaboration,
  SubmissionEntry
} from '../types/collaboration';
import { 
  CollaborationService, 
  ProjectService, 
  UserService, 
  InteractionService, 
  DataService,
  SubmissionService
} from '../services';
import { TrackUtils } from '../utils';
import { AudioUrlUtils } from '../utils/audioUrlUtils';

const DEBUG_LOGS = true;

// Helper to pre-cache all audio URLs for faster playback
async function precacheAudioUrls(collaboration: Collaboration): Promise<void> {
  const paths: string[] = [
    collaboration.backingTrackPath,
    ...(collaboration.submissions?.map(s => s.path) || []),
    ...(collaboration.submissions?.map(s => s.optimizedPath).filter(Boolean) || [])
  ].filter(Boolean) as string[];
  
  if (paths.length === 0) return;
  
  const startTime = performance.now();
  // Fetch all URLs in parallel
  await Promise.allSettled(
    paths.map(path => AudioUrlUtils.resolveAudioUrl(path))
  );
  const duration = (performance.now() - startTime).toFixed(0);
  if (DEBUG_LOGS) console.log(`Pre-cached ${paths.length} audio URLs in ${duration}ms`);
}

const createTrackFromFilePath = TrackUtils.createTrackFromFilePath;

interface CollaborationState {
  currentProject: Project | null;
  currentCollaboration: Collaboration | null;
  userCollaboration: UserCollaboration | null;
  userCollaborations: Collaboration[];
  
  allTracks: Track[];
  regularTracks: Track[];
  pastStageTracks: Track[];
  backingTrack: Track | null;
  favorites: Track[];
  
  isLoadingCollaboration: boolean;
  isLoadingProject: boolean;
  isUpdatingFavorites: boolean;
  isUpdatingListened: boolean;
  
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
  
  isTrackListened: (filePath: string) => boolean;
  isTrackFavorite: (filePath: string) => boolean;
  getTrackByFilePath: (filePath: string) => Track | undefined;
  approveSubmission?: (track: Track) => Promise<void>;
  rejectSubmission?: (track: Track) => Promise<void>;
}

export const useCollaborationStore = create<CollaborationState>((set, get) => ({
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

  setCurrentProject: (project) => set({ currentProject: project }),
  setCurrentCollaboration: (collaboration) => set({ currentCollaboration: collaboration }),
  setUserCollaboration: (collaboration) => set({ userCollaboration: collaboration }),
  setUserCollaborations: (collaborations) => set({ userCollaborations: collaborations }),

  setTracks: (tracks) => {
    const { userCollaboration, currentCollaboration } = get();
    const favoriteFilePaths = userCollaboration?.favoriteTracks || [];
    
    const trackObjects = tracks.map(track => 
      createTrackFromFilePath(track.filePath, 'submission', currentCollaboration?.id || '')
    );
    
    const regularTracks = trackObjects.filter(track => 
      !favoriteFilePaths.includes(track.filePath)
    );
    
    const pastStageTracks: Track[] = [];
    const backingTrack: Track | null = null;
    
    set({ 
      allTracks: trackObjects, 
      regularTracks,
      pastStageTracks,
      backingTrack
    });
  },

  loadCollaboration: async (userId: string, collaborationId: string) => {
    try {
      if (DEBUG_LOGS) console.log('loading collaboration data for:', collaborationId);
      set({ isLoadingCollaboration: true });
      
      const collaborationData = await DataService.loadCollaborationData(userId, collaborationId);
      if (DEBUG_LOGS) console.log('loaded collaboration.submissions:', collaborationData.collaboration?.submissions);
      
      if (!collaborationData.collaboration) {
        set({ isLoadingCollaboration: false });
        return;
      }
      
      const collab = collaborationData.collaboration;
      const submissionTracks = (collab.submissions && collab.submissions.length > 0)
        ? collab.submissions.map((s: SubmissionEntry) => {
            if (DEBUG_LOGS) console.log('tracks from submissions[]', s);
            const moderationStatus = s.moderationStatus || (collab.requiresModeration ? 'pending' : 'approved');
            return createTrackFromFilePath(s.path, 'submission', collab.id, {
              settings: s.settings,
              optimizedPath: s.optimizedPath,
              submissionId: s.submissionId,
              multitrackZipPath: s.multitrackZipPath,
              moderationStatus
            });
          })
        : (collab as any).submissionPaths?.map((path: string) => {
            if (DEBUG_LOGS) console.log('tracks from legacy submissionPaths[]', path);
            return createTrackFromFilePath(path, 'submission', collab.id);
          }) || [];
      const backingTrack = collab.backingTrackPath ? 
        createTrackFromFilePath(collab.backingTrackPath, 'backing', collab.id) : null;
      
      const favoriteFilePaths = collaborationData.userCollaboration?.favoriteTracks || [];
      const favorites = submissionTracks.filter((track: Track) => 
        favoriteFilePaths.includes(track.filePath)
      );
      const regularTracks = submissionTracks.filter((track: Track) => 
        !favoriteFilePaths.includes(track.filePath)
      );
      
      set({
        currentCollaboration: collaborationData.collaboration,
        userCollaboration: collaborationData.userCollaboration,
        allTracks: submissionTracks,
        regularTracks,
        favorites,
        pastStageTracks: [],
        backingTrack,
        isLoadingCollaboration: false
      });
      
      if (collaborationData.collaboration.projectId) {
        get().loadProject(collaborationData.collaboration.projectId);
      }
      
      // Pre-cache all audio URLs for faster playback
      precacheAudioUrls(collab).catch(err => {
        if (DEBUG_LOGS) console.warn('Failed to pre-cache audio URLs:', err);
      });
      
      if (DEBUG_LOGS) console.log('collaboration data loaded successfully');
    } catch (error) {
      if (DEBUG_LOGS) console.error('error loading collaboration data:', error);
      set({ isLoadingCollaboration: false });
    }
  },

  loadCollaborationAnonymous: async () => {
    try {
      if (DEBUG_LOGS) console.log('loading collaboration data for anonymous user');
      set({ isLoadingCollaboration: true });
      
      const collaboration = await CollaborationService.getFirstCollaboration();
      if (!collaboration) {
        throw new Error('No collaborations found');
      }
      
      const collaborationData = await DataService.loadCollaborationDataAnonymous(collaboration.id);
      if (DEBUG_LOGS) console.log('loaded (anon) collaboration.submissions:', collaborationData.collaboration?.submissions);
      
      if (!collaborationData.collaboration) {
        set({ isLoadingCollaboration: false });
        return;
      }
      
      const collab = collaborationData.collaboration;
      const submissionTracks = (collab.submissions && collab.submissions.length > 0)
        ? collab.submissions.map((s: SubmissionEntry) => {
            if (DEBUG_LOGS) console.log('tracks from submissions[] (anon)', s);
            const moderationStatus = s.moderationStatus || (collab.requiresModeration ? 'pending' : 'approved');
            return createTrackFromFilePath(s.path, 'submission', collab.id, {
              settings: s.settings,
              optimizedPath: s.optimizedPath,
              submissionId: s.submissionId,
              moderationStatus
            });
          })
        : (collab as any).submissionPaths?.map((path: string) => {
            if (DEBUG_LOGS) console.log('tracks from legacy submissionPaths[] (anon)', path);
            return createTrackFromFilePath(path, 'submission', collab.id);
          }) || [];
      const backingTrack = collab.backingTrackPath ? 
        createTrackFromFilePath(collab.backingTrackPath, 'backing', collab.id) : null;
      
      const regularTracks = submissionTracks;
      
      set({
        currentCollaboration: collaborationData.collaboration,
        userCollaboration: null,
        allTracks: submissionTracks,
        regularTracks,
        pastStageTracks: [],
        backingTrack,
        isLoadingCollaboration: false
      });
      
      if (collaborationData.collaboration.projectId) {
        get().loadProject(collaborationData.collaboration.projectId);
      }
      
      // Pre-cache all audio URLs for faster playback
      precacheAudioUrls(collab).catch(err => {
        if (DEBUG_LOGS) console.warn('Failed to pre-cache audio URLs:', err);
      });
      
      if (DEBUG_LOGS) console.log('collaboration data loaded successfully for anonymous user');
    } catch (error) {
      if (DEBUG_LOGS) console.error('error loading collaboration data for anonymous user:', error);
      set({ isLoadingCollaboration: false });
    }
  },

  loadCollaborationAnonymousById: async (collaborationId: string) => {
    try {
      if (DEBUG_LOGS) console.log('loading collaboration data for anonymous user by id');
      set({ isLoadingCollaboration: true });
      const collaborationData = await DataService.loadCollaborationDataAnonymous(collaborationId);
      if (DEBUG_LOGS) console.log('loaded (anon by id) collaboration.submissions:', collaborationData.collaboration?.submissions);
      
      if (!collaborationData.collaboration) {
        set({ isLoadingCollaboration: false });
        return;
      }
      
      const collab = collaborationData.collaboration;
      const submissionTracks = (collab.submissions && collab.submissions.length > 0)
        ? collab.submissions.map((s: SubmissionEntry) => {
            if (DEBUG_LOGS) console.log('tracks from submissions[] (anon by id)', s);
            const moderationStatus = s.moderationStatus || (collab.requiresModeration ? 'pending' : 'approved');
            return createTrackFromFilePath(s.path, 'submission', collab.id, {
              settings: s.settings,
              optimizedPath: s.optimizedPath,
              submissionId: s.submissionId,
              moderationStatus
            });
          })
        : (collab as any).submissionPaths?.map((path: string) => {
            if (DEBUG_LOGS) console.log('tracks from legacy submissionPaths[] (anon by id)', path);
            return createTrackFromFilePath(path, 'submission', collab.id);
          }) || [];
      const backingTrack = collab.backingTrackPath ? 
        createTrackFromFilePath(collab.backingTrackPath, 'backing', collab.id) : null;
      const regularTracks = submissionTracks;
      set({
        currentCollaboration: collaborationData.collaboration,
        userCollaboration: null,
        allTracks: submissionTracks,
        regularTracks,
        pastStageTracks: [],
        backingTrack,
        isLoadingCollaboration: false
      });
      if (collaborationData.collaboration.projectId) {
        get().loadProject(collaborationData.collaboration.projectId);
      }
      
      // Pre-cache all audio URLs for faster playback
      precacheAudioUrls(collab).catch(err => {
        if (DEBUG_LOGS) console.warn('Failed to pre-cache audio URLs:', err);
      });
    } catch (error) {
      if (DEBUG_LOGS) console.error('error loading anonymous collab by id:', error);
      set({ isLoadingCollaboration: false });
    }
  },

  loadProject: async (projectId: string) => {
    try {
      if (DEBUG_LOGS) console.log('loading project data for:', projectId);
      set({ isLoadingProject: true });
      
      const project = await ProjectService.getProject(projectId);
      
      if (project) {
        const pastStageTracks = project.pastCollaborations
          .map(pastCollab => {
            const path =
              pastCollab.winnerTrackPath ||
              pastCollab.pastStageTrackPath ||
              pastCollab.backingTrackPath ||
              '';
            if (!path) return null;
            return createTrackFromFilePath(
              path,
              'pastStage',
              pastCollab.collaborationId
            );
          })
          .filter((track): track is ReturnType<typeof createTrackFromFilePath> => !!track);
        
        set({
          currentProject: project,
          pastStageTracks,
          isLoadingProject: false
        });
        
        if (DEBUG_LOGS) console.log('project data loaded successfully');
      } else {
        set({ isLoadingProject: false });
      }
    } catch (error) {
      if (DEBUG_LOGS) console.error('error loading project data:', error);
      set({ isLoadingProject: false });
    }
  },

  markAsListened: async (filePath) => {
    const { userCollaboration, currentCollaboration } = get();
    const userId = userCollaboration?.userId;
    
    if (!userId || !currentCollaboration) return;
    
    try {
      set({ isUpdatingListened: true });
      await InteractionService.markTrackAsListened(userId, currentCollaboration.id, filePath);
      
      const listenedTracks = [...(userCollaboration.listenedTracks || [])];
      if (!listenedTracks.includes(filePath)) {
        listenedTracks.push(filePath);
        set({ 
          userCollaboration: { ...userCollaboration, listenedTracks },
          isUpdatingListened: false
        });
      } else {
        set({ isUpdatingListened: false });
      }
    } catch (error) {
      if (DEBUG_LOGS) console.error('Error marking track as listened:', error);
      set({ isUpdatingListened: false });
    }
  },

  addToFavorites: async (filePath) => {
    const { userCollaboration, currentCollaboration, allTracks } = get();
    const userId = userCollaboration?.userId;
    
    if (!userId || !currentCollaboration) return;
    
    try {
      set({ isUpdatingFavorites: true });
      await InteractionService.addTrackToFavorites(userId, currentCollaboration.id, filePath);
      
      const favoriteTracks = [...(userCollaboration.favoriteTracks || [])];
      if (!favoriteTracks.includes(filePath)) {
        favoriteTracks.push(filePath);
        
        const { favorites, regular } = TrackUtils.filterByFavorites(allTracks, favoriteTracks);
        
        set({ 
          userCollaboration: { ...userCollaboration, favoriteTracks },
          favorites,
          regularTracks: regular,
          isUpdatingFavorites: false
        });
      } else {
        set({ isUpdatingFavorites: false });
      }
    } catch (error) {
      if (DEBUG_LOGS) console.error('Error adding to favorites:', error);
      set({ isUpdatingFavorites: false });
    }
  },

  removeFromFavorites: async (filePath) => {
    const { userCollaboration, currentCollaboration, allTracks } = get();
    const userId = userCollaboration?.userId;
    
    if (!userId || !currentCollaboration) return;
    
    try {
      set({ isUpdatingFavorites: true });
      await InteractionService.removeTrackFromFavorites(userId, currentCollaboration.id, filePath);
      
      const favoriteTracks = (userCollaboration.favoriteTracks || []).filter(track => track !== filePath);
      
      const { favorites, regular } = TrackUtils.filterByFavorites(allTracks, favoriteTracks);
      
      set({ 
        userCollaboration: { ...userCollaboration, favoriteTracks },
        favorites,
        regularTracks: regular,
        isUpdatingFavorites: false
      });
    } catch (error) {
      if (DEBUG_LOGS) console.error('Error removing from favorites:', error);
      set({ isUpdatingFavorites: false });
    }
  },

  voteFor: async (filePath) => {
    const { userCollaboration, currentCollaboration } = get();
    const userId = userCollaboration?.userId;
    
    if (!userId || !currentCollaboration) return;
    
    try {
      await InteractionService.voteForTrack(userId, currentCollaboration.id, filePath);
      set({ 
        userCollaboration: { ...userCollaboration, finalVote: filePath }
      });
    } catch (error) {
      if (DEBUG_LOGS) console.error('Error voting for track:', error);
    }
  },

  setListenedRatio: (ratio) => {
    const { userCollaboration } = get();
    if (userCollaboration) {
      set({ 
        userCollaboration: { ...userCollaboration, listenedRatio: ratio }
      });
    }
  },

  isTrackListened: (filePath) => {
    const { userCollaboration } = get();
    return userCollaboration?.listenedTracks?.includes(filePath) || false;
  },

  isTrackFavorite: (filePath) => {
    const { userCollaboration } = get();
    return userCollaboration?.favoriteTracks?.includes(filePath) || false;
  },

  getTrackByFilePath: (filePath) => {
    const { allTracks } = get();
    return TrackUtils.findTrackByFilePath(allTracks, filePath);
  },

  loadUserCollaborations: async (userId) => {
    try {
      const collaborations = await UserService.getUserCollaborations(userId);
      set({ userCollaborations: collaborations });
    } catch (error) {
      if (DEBUG_LOGS) console.error('Error loading user collaborations:', error);
    }
  }
}));
