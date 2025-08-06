import { 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  collection, 
  query, 
  where, 
  updateDoc,
  addDoc,
  deleteDoc,
  Timestamp 
} from 'firebase/firestore';
import { db } from './firebase';
import type { 
  Project, 
  Track, 
  UserCollaboration, 
  TrackId, 
  ProjectId, 
  UserId,
  COLLECTIONS 
} from '../types/collaboration';

export class CollaborationService {
  // Project Management
  static async createProject(project: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>): Promise<Project> {
    const now = Timestamp.now();
    const projectData: Project = {
      ...project,
      id: '', // Will be set by Firestore
      createdAt: now,
      updatedAt: now
    };

    const docRef = await addDoc(collection(db, COLLECTIONS.PROJECTS), projectData);
    return { ...projectData, id: docRef.id };
  }

  static async getProject(projectId: ProjectId): Promise<Project | null> {
    const docRef = doc(db, COLLECTIONS.PROJECTS, projectId);
    const docSnap = await getDoc(docRef);
    
    if (!docSnap.exists()) {
      return null;
    }
    
    return { id: docSnap.id, ...docSnap.data() } as Project;
  }

  static async updateProject(projectId: ProjectId, updates: Partial<Project>): Promise<void> {
    const docRef = doc(db, COLLECTIONS.PROJECTS, projectId);
    await updateDoc(docRef, {
      ...updates,
      updatedAt: Timestamp.now()
    });
  }

  // Track Management
  static async createTrack(track: Omit<Track, 'id' | 'createdAt'>): Promise<Track> {
    const now = Timestamp.now();
    const trackData: Track = {
      ...track,
      id: '', // Will be set by Firestore
      createdAt: now
    };

    const docRef = await addDoc(collection(db, COLLECTIONS.TRACKS), trackData);
    return { ...trackData, id: docRef.id };
  }

  static async getTracksByProject(projectId: ProjectId): Promise<Track[]> {
    const q = query(
      collection(db, COLLECTIONS.TRACKS),
      where('projectId', '==', projectId)
    );
    
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Track);
  }

  static async updateTrack(trackId: TrackId, updates: Partial<Track>): Promise<void> {
    const docRef = doc(db, COLLECTIONS.TRACKS, trackId);
    await updateDoc(docRef, updates);
  }

  // User Collaboration Management
  static async getUserCollaboration(userId: UserId, projectId: ProjectId): Promise<UserCollaboration | null> {
    const q = query(
      collection(db, COLLECTIONS.USER_COLLABORATIONS),
      where('userId', '==', userId),
      where('projectId', '==', projectId)
    );
    
    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) {
      return null;
    }
    
    const doc = querySnapshot.docs[0];
    return { id: doc.id, ...doc.data() } as UserCollaboration;
  }

  static async createUserCollaboration(collaboration: Omit<UserCollaboration, 'id' | 'createdAt' | 'lastInteraction'>): Promise<UserCollaboration> {
    const now = Timestamp.now();
    const collaborationData: UserCollaboration = {
      ...collaboration,
      id: '', // Will be set by Firestore
      createdAt: now,
      lastInteraction: now
    };

    const docRef = await addDoc(collection(db, COLLECTIONS.USER_COLLABORATIONS), collaborationData);
    return { ...collaborationData, id: docRef.id };
  }

  static async updateUserCollaboration(
    userId: UserId, 
    projectId: ProjectId, 
    updates: Partial<UserCollaboration>
  ): Promise<void> {
    const collaboration = await this.getUserCollaboration(userId, projectId);
    if (!collaboration) {
      throw new Error('User collaboration not found');
    }

    const docRef = doc(db, COLLECTIONS.USER_COLLABORATIONS, collaboration.id);
    await updateDoc(docRef, {
      ...updates,
      lastInteraction: Timestamp.now()
    });
  }

  // Collaboration Actions
  static async markTrackAsListened(userId: UserId, projectId: ProjectId, trackId: TrackId): Promise<void> {
    const collaboration = await this.getUserCollaboration(userId, projectId);
    
    if (!collaboration) {
      // Create new collaboration
      await this.createUserCollaboration({
        userId,
        projectId,
        listenedTracks: [trackId],
        favoriteTracks: [],
        finalVote: null,
        listenedRatio: 7
      });
    } else {
      // Update existing collaboration
      const listenedTracks = [...collaboration.listenedTracks];
      if (!listenedTracks.includes(trackId)) {
        listenedTracks.push(trackId);
        await this.updateUserCollaboration(userId, projectId, { listenedTracks });
      }
    }
  }

  static async addTrackToFavorites(userId: UserId, projectId: ProjectId, trackId: TrackId): Promise<void> {
    const collaboration = await this.getUserCollaboration(userId, projectId);
    
    if (!collaboration) {
      // Create new collaboration
      await this.createUserCollaboration({
        userId,
        projectId,
        listenedTracks: [],
        favoriteTracks: [trackId],
        finalVote: null,
        listenedRatio: 7
      });
    } else {
      // Update existing collaboration
      const favoriteTracks = [...collaboration.favoriteTracks];
      if (!favoriteTracks.includes(trackId)) {
        favoriteTracks.push(trackId);
        await this.updateUserCollaboration(userId, projectId, { favoriteTracks });
      }
    }
  }

  static async removeTrackFromFavorites(userId: UserId, projectId: ProjectId, trackId: TrackId): Promise<void> {
    const collaboration = await this.getUserCollaboration(userId, projectId);
    
    if (collaboration) {
      const favoriteTracks = collaboration.favoriteTracks.filter(id => id !== trackId);
      await this.updateUserCollaboration(userId, projectId, { favoriteTracks });
    }
  }

  static async voteForTrack(userId: UserId, projectId: ProjectId, trackId: TrackId): Promise<void> {
    const collaboration = await this.getUserCollaboration(userId, projectId);
    
    if (!collaboration) {
      // Create new collaboration
      await this.createUserCollaboration({
        userId,
        projectId,
        listenedTracks: [],
        favoriteTracks: [],
        finalVote: trackId,
        listenedRatio: 7
      });
    } else {
      // Update existing collaboration
      await this.updateUserCollaboration(userId, projectId, { finalVote: trackId });
    }
  }

  static async setListenedRatio(userId: UserId, projectId: ProjectId, ratio: number): Promise<void> {
    const collaboration = await this.getUserCollaboration(userId, projectId);
    
    if (collaboration) {
      await this.updateUserCollaboration(userId, projectId, { listenedRatio: ratio });
    }
  }

  // Data Loading
  static async loadCollaborationData(userId: UserId, projectId: ProjectId): Promise<{
    project: Project;
    userCollaboration: UserCollaboration | null;
    tracks: Track[];
  }> {
    const [project, userCollaboration, tracks] = await Promise.all([
      this.getProject(projectId),
      this.getUserCollaboration(userId, projectId),
      this.getTracksByProject(projectId)
    ]);

    if (!project) {
      throw new Error('Project not found');
    }

    return {
      project,
      userCollaboration,
      tracks
    };
  }
} 