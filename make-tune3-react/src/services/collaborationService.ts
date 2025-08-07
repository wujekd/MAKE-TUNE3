import { 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  collection, 
  query, 
  where, 
  limit,
  updateDoc,
  addDoc,
  deleteDoc,
  Timestamp 
} from 'firebase/firestore';
import { db } from './firebase';
import type { 
  Project, 
  Collaboration,
  Track, 
  UserCollaboration, 
  UserProfile,
  TrackId, 
  ProjectId, 
  CollaborationId,
  UserId
} from '../types/collaboration';
import { COLLECTIONS } from '../types/collaboration';

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

  // Collaboration Management
  static async createCollaboration(collaboration: Omit<Collaboration, 'id' | 'createdAt' | 'updatedAt'>): Promise<Collaboration> {
    const now = Timestamp.now();
    const collaborationData: Collaboration = {
      ...collaboration,
      id: '', // Will be set by Firestore
      createdAt: now,
      publishedAt: collaboration.publishedAt || null,
      updatedAt: now
    };

    const docRef = await addDoc(collection(db, COLLECTIONS.COLLABORATIONS), collaborationData);
    return { ...collaborationData, id: docRef.id };
  }

  static async getCollaboration(collaborationId: CollaborationId): Promise<Collaboration | null> {
    const docRef = doc(db, COLLECTIONS.COLLABORATIONS, collaborationId);
    const docSnap = await getDoc(docRef);
    
    if (!docSnap.exists()) {
      return null;
    }
    
    return { id: docSnap.id, ...docSnap.data() } as Collaboration;
  }

  static async getCollaborationsByProject(projectId: ProjectId): Promise<Collaboration[]> {
    const q = query(
      collection(db, COLLECTIONS.COLLABORATIONS),
      where('projectId', '==', projectId)
    );
    
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Collaboration);
  }

  static async updateCollaboration(collaborationId: CollaborationId, updates: Partial<Collaboration>): Promise<void> {
    const docRef = doc(db, COLLECTIONS.COLLABORATIONS, collaborationId);
    await updateDoc(docRef, {
      ...updates,
      updatedAt: Timestamp.now()
    });
  }

  // Track Management - Removed (no longer needed with file path based model)

  // User Profile Management
  static async getUserProfile(userId: UserId): Promise<UserProfile | null> {
    const docRef = doc(db, COLLECTIONS.USERS, userId);
    const docSnap = await getDoc(docRef);
    
    if (!docSnap.exists()) {
      return null;
    }
    
    return { uid: docSnap.id, ...docSnap.data() } as UserProfile;
  }

  static async updateUserProfile(userId: UserId, updates: Partial<UserProfile>): Promise<void> {
    const docRef = doc(db, COLLECTIONS.USERS, userId);
    await updateDoc(docRef, updates);
  }

  static async addCollaborationToUser(userId: UserId, collaborationId: CollaborationId): Promise<void> {
    const userProfile = await this.getUserProfile(userId);
    if (!userProfile) {
      throw new Error('User profile not found');
    }

    const collaborationIds = [...userProfile.collaborationIds];
    if (!collaborationIds.includes(collaborationId)) {
      collaborationIds.push(collaborationId);
      await this.updateUserProfile(userId, { collaborationIds });
    }
  }

  // User Collaboration Management
  static async getUserCollaboration(userId: UserId, collaborationId: CollaborationId): Promise<UserCollaboration | null> {
    const q = query(
      collection(db, COLLECTIONS.USER_COLLABORATIONS),
      where('userId', '==', userId),
      where('collaborationId', '==', collaborationId)
    );
    
    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) {
      return null;
    }
    
    const doc = querySnapshot.docs[0];
    return { ...doc.data() } as UserCollaboration;
  }

  static async createUserCollaboration(collaboration: Omit<UserCollaboration, 'createdAt' | 'lastInteraction'>): Promise<UserCollaboration> {
    const now = Timestamp.now();
    const collaborationData: UserCollaboration = {
      ...collaboration,
      createdAt: now,
      lastInteraction: now
    };

    const docRef = await addDoc(collection(db, COLLECTIONS.USER_COLLABORATIONS), collaborationData);
    
    // Add collaboration to user's profile
    await this.addCollaborationToUser(collaboration.userId, collaboration.collaborationId);
    
    return collaborationData;
  }

  static async updateUserCollaboration(
    userId: UserId, 
    collaborationId: CollaborationId, 
    updates: Partial<UserCollaboration>
  ): Promise<void> {
    const collaboration = await this.getUserCollaboration(userId, collaborationId);
    if (!collaboration) {
      throw new Error('User collaboration not found');
    }

    // Find the document ID by querying again
    const q = query(
      collection(db, COLLECTIONS.USER_COLLABORATIONS),
      where('userId', '==', userId),
      where('collaborationId', '==', collaborationId)
    );
    
    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) {
      throw new Error('User collaboration not found');
    }
    
    const docRef = doc(db, COLLECTIONS.USER_COLLABORATIONS, querySnapshot.docs[0].id);
    await updateDoc(docRef, {
      ...updates,
      lastInteraction: Timestamp.now()
    });
  }

  // Collaboration Actions
  static async markTrackAsListened(userId: UserId, collaborationId: CollaborationId, filePath: string): Promise<void> {
    const collaboration = await this.getUserCollaboration(userId, collaborationId);
    
    if (!collaboration) {
      // Create new collaboration
      await this.createUserCollaboration({
        userId,
        collaborationId,
        listenedTracks: [filePath],
        favoriteTracks: [],
        finalVote: null,
        listenedRatio: 7
      });
    } else {
      // Update existing collaboration
      const listenedTracks = [...collaboration.listenedTracks];
      if (!listenedTracks.includes(filePath)) {
        listenedTracks.push(filePath);
        await this.updateUserCollaboration(userId, collaborationId, { listenedTracks });
      }
    }
  }

  static async addTrackToFavorites(userId: UserId, collaborationId: CollaborationId, filePath: string): Promise<void> {
    const collaboration = await this.getUserCollaboration(userId, collaborationId);
    
    if (!collaboration) {
      // Create new collaboration
      await this.createUserCollaboration({
        userId,
        collaborationId,
        listenedTracks: [],
        favoriteTracks: [filePath],
        finalVote: null,
        listenedRatio: 7
      });
    } else {
      // Update existing collaboration
      const favoriteTracks = [...collaboration.favoriteTracks];
      if (!favoriteTracks.includes(filePath)) {
        favoriteTracks.push(filePath);
        await this.updateUserCollaboration(userId, collaborationId, { favoriteTracks });
      }
    }
  }

  static async removeTrackFromFavorites(userId: UserId, collaborationId: CollaborationId, filePath: string): Promise<void> {
    const collaboration = await this.getUserCollaboration(userId, collaborationId);
    
    if (collaboration) {
      const favoriteTracks = collaboration.favoriteTracks.filter(path => path !== filePath);
      await this.updateUserCollaboration(userId, collaborationId, { favoriteTracks });
    }
  }

  static async voteForTrack(userId: UserId, collaborationId: CollaborationId, filePath: string): Promise<void> {
    const collaboration = await this.getUserCollaboration(userId, collaborationId);
    
    if (!collaboration) {
      // Create new collaboration
      await this.createUserCollaboration({
        userId,
        collaborationId,
        listenedTracks: [],
        favoriteTracks: [],
        finalVote: filePath,
        listenedRatio: 7
      });
    } else {
      // Update existing collaboration
      await this.updateUserCollaboration(userId, collaborationId, { finalVote: filePath });
    }
  }

  static async setListenedRatio(userId: UserId, collaborationId: CollaborationId, ratio: number): Promise<void> {
    const collaboration = await this.getUserCollaboration(userId, collaborationId);
    
    if (collaboration) {
      await this.updateUserCollaboration(userId, collaborationId, { listenedRatio: ratio });
    }
  }

  // Data Loading
  static async loadCollaborationData(userId: UserId, collaborationId: CollaborationId): Promise<{
    collaboration: Collaboration;
    userCollaboration: UserCollaboration | null;
  }> {
    const [collaboration, userCollaboration] = await Promise.all([
      this.getCollaboration(collaborationId),
      this.getUserCollaboration(userId, collaborationId)
    ]);

    if (!collaboration) {
      throw new Error('Collaboration not found');
    }

    return {
      collaboration,
      userCollaboration
    };
  }

  // Load collaboration data for anonymous users (no user-specific data)
  static async loadCollaborationDataAnonymous(collaborationId: CollaborationId): Promise<{
    collaboration: Collaboration;
    userCollaboration: null;
  }> {
    const collaboration = await this.getCollaboration(collaborationId);

    if (!collaboration) {
      throw new Error('Collaboration not found');
    }

    return {
      collaboration,
      userCollaboration: null
    };
  }

  // Get user's collaboration list
  static async getUserCollaborations(userId: UserId): Promise<Collaboration[]> {
    const userProfile = await this.getUserProfile(userId);
    if (!userProfile || !userProfile.collaborationIds || userProfile.collaborationIds.length === 0) {
      return [];
    }

    const collaborations = await Promise.all(
      userProfile.collaborationIds.map(id => this.getCollaboration(id))
    );

    return collaborations.filter((collab): collab is Collaboration => collab !== null);
  }

  // Get first available collaboration for anonymous users
  static async getFirstCollaboration(): Promise<Collaboration | null> {
    const q = query(collection(db, COLLECTIONS.COLLABORATIONS), limit(1));
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      return null;
    }
    
    const doc = querySnapshot.docs[0];
    return { id: doc.id, ...doc.data() } as Collaboration;
  }
} 