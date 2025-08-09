import { 
  doc, 
  getDoc, 
  getDocs, 
  collection, 
  query, 
  where, 
  limit,
  updateDoc,
  addDoc,
  deleteDoc,
  Timestamp, 
  arrayUnion
} from 'firebase/firestore';
import { db, storage } from './firebase';
import { ref, uploadBytes } from 'firebase/storage';
import { DEBUG_ALLOW_MULTIPLE_SUBMISSIONS } from '../config';
import type { 
  Project, 
  Collaboration,
  UserCollaboration, 
  UserProfile,
  ProjectId, 
  CollaborationId,
  UserId
} from '../types/collaboration';
import { COLLECTIONS } from '../types/collaboration';
import { runTransaction, serverTimestamp } from 'firebase/firestore';

export class CollaborationService {
  private static getPreferredAudioExtension(file: File): string {
    const allowed = new Set(['mp3', 'wav', 'flac', 'ogg', 'm4a', 'aac', 'webm', 'opus']);
    const nameExt = (file.name.split('.').pop() || '').toLowerCase();
    if (allowed.has(nameExt)) return nameExt;
    const mimeToExt: Record<string, string> = {
      'audio/mpeg': 'mp3',
      'audio/wav': 'wav',
      'audio/x-wav': 'wav',
      'audio/flac': 'flac',
      'audio/x-flac': 'flac',
      'audio/ogg': 'ogg',
      'audio/opus': 'opus',
      'audio/mp4': 'm4a',
      'audio/aac': 'aac',
      'audio/x-m4a': 'm4a',
      'audio/webm': 'webm'
    };
    return mimeToExt[file.type] || 'audio';
  }
  // Project Management
  static async createProject(project: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>): Promise<Project> {
    const now = Timestamp.now();
    const projectData = {
      ...project,
      createdAt: now,
      updatedAt: now
    } as Omit<Project, 'id'>;

    const docRef = await addDoc(collection(db, COLLECTIONS.PROJECTS), projectData as any);
    return { ...(projectData as any), id: docRef.id } as Project;
  }

  static async getProject(projectId: ProjectId): Promise<Project | null> {
    const docRef = doc(db, COLLECTIONS.PROJECTS, projectId);
    const docSnap = await getDoc(docRef);
    
    if (!docSnap.exists()) {
      return null;
    }
    
    return { ...(docSnap.data() as any), id: docSnap.id } as Project;
  }

  static async updateProject(projectId: ProjectId, updates: Partial<Project>): Promise<void> {
    const docRef = doc(db, COLLECTIONS.PROJECTS, projectId);
    await updateDoc(docRef, {
      ...updates,
      updatedAt: Timestamp.now()
    });
  }

  static async deleteProject(projectId: ProjectId): Promise<void> {
    const docRef = doc(db, COLLECTIONS.PROJECTS, projectId);
    await deleteDoc(docRef);
  }

  // Collaboration Management
  static async createCollaboration(collaboration: Omit<Collaboration, 'id' | 'createdAt' | 'updatedAt'>): Promise<Collaboration> {
    const now = Timestamp.now();
    const collaborationData = {
      ...collaboration,
      createdAt: now,
      publishedAt: (collaboration as any).publishedAt || null,
      updatedAt: now
    } as Omit<Collaboration, 'id'>;

    const docRef = await addDoc(collection(db, COLLECTIONS.COLLABORATIONS), collaborationData as any);
    return { ...(collaborationData as any), id: docRef.id } as Collaboration;
  }

  static async uploadBackingTrack(file: File, collaborationId: string): Promise<string> {
    const ext = this.getPreferredAudioExtension(file);
    const path = `collabs/${collaborationId}/backing.${ext}`;
    const r = ref(storage, path);
    await uploadBytes(r, file, { contentType: file.type });
    return path;
  }

  static async hasUserSubmitted(collaborationId: CollaborationId, userId: UserId): Promise<boolean> {
    const collabRef = doc(db, COLLECTIONS.COLLABORATIONS, collaborationId);
    const snap = await getDoc(collabRef);
    const data = snap.exists() ? (snap.data() as Collaboration) : null;
    const list = (data && Array.isArray((data as any).participantIds)) ? (data as any).participantIds as string[] : [];
    if (DEBUG_ALLOW_MULTIPLE_SUBMISSIONS) return false;
    return list.includes(userId);
  }

  static async uploadSubmission(file: File, collaborationId: CollaborationId, userId: UserId, title?: string): Promise<{ filePath: string; submissionId: string }> {
    const exists = await this.hasUserSubmitted(collaborationId, userId);
    if (exists) {
      throw new Error('already submitted');
    }
    const ext = this.getPreferredAudioExtension(file);
    const submissionId = (typeof crypto !== 'undefined' && (crypto as any).randomUUID) ? (crypto as any).randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const path = `collabs/${collaborationId}/submissions/${submissionId}.${ext}`;
    const r = ref(storage, path);
    const uploaded = await uploadBytes(r, file, { contentType: file.type, customMetadata: { ownerUid: userId } });
    const createdAt = Timestamp.now();

    // Gate: append userId to participantIds list on collaboration
    const collabRef = doc(db, COLLECTIONS.COLLABORATIONS, collaborationId);
    await updateDoc(collabRef, { participantIds: arrayUnion(userId), updatedAt: Timestamp.now() });

    // Private record: create top-level submissionUsers doc with full linkage
    await addDoc(collection(db, COLLECTIONS.SUBMISSION_USERS), {
      userId,
      collaborationId,
      submissionId,
      path,
      title: title || '',
      contentType: uploaded.metadata.contentType || file.type,
      size: uploaded.metadata.size || file.size,
      createdAt
    });

    const collabSnap = await getDoc(collabRef);
    if (collabSnap.exists()) {
      const data = collabSnap.data() as Collaboration;
      const needsMod = data.requiresModeration ? true : (data.needsModeration === true);
      await updateDoc(collabRef, { submissionPaths: arrayUnion(path), updatedAt: Timestamp.now(), needsModeration: needsMod });
    }

    return { filePath: path, submissionId };
  }

  static async getCollaboration(collaborationId: CollaborationId): Promise<Collaboration | null> {
    const docRef = doc(db, COLLECTIONS.COLLABORATIONS, collaborationId);
    const docSnap = await getDoc(docRef);
    
    if (!docSnap.exists()) {
      return null;
    }
    
    return { ...(docSnap.data() as any), id: docSnap.id } as Collaboration;
  }

  static async getCollaborationsByProject(projectId: ProjectId): Promise<Collaboration[]> {
    const q = query(
      collection(db, COLLECTIONS.COLLABORATIONS),
      where('projectId', '==', projectId)
    );
    
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(d => ({ ...(d.data() as any), id: d.id }) as Collaboration);
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

    await addDoc(collection(db, COLLECTIONS.USER_COLLABORATIONS), collaborationData);
    
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
    
    const ucRef = doc(db, COLLECTIONS.USER_COLLABORATIONS, querySnapshot.docs[0].id);
    await updateDoc(ucRef, {
      ...updates,
      lastInteraction: Timestamp.now()
    });
  }

  // moderation
  static async setSubmissionApproved(): Promise<void> {
    // using file paths model: update collaboration submissionPaths is not needed for approval flag.
    // store approval in a separate collection or embed if we had track docs.
    // for now, noop placeholder; integrate with real schema later.
    return;
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
    
    const d = querySnapshot.docs[0];
    return ({ ...(d.data() as any), id: d.id }) as Collaboration;
  }

  // list published collaborations
  static async listPublishedCollaborations(): Promise<Collaboration[]> {
    const q = query(
      collection(db, COLLECTIONS.COLLABORATIONS),
      where('status', 'in', ['submission', 'voting', 'completed'])
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ ...(d.data() as any), id: d.id } as Collaboration));
  }

  // list projects owned by user
  static async listUserProjects(userId: string): Promise<Project[]> {
    const q = query(
      collection(db, COLLECTIONS.PROJECTS),
      where('ownerId', '==', userId)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Project));
  }

  // normalize name to key
  static buildNameKey(name: string): string {
    return name
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/[^a-z0-9 ]/g, '')
      .replace(/\s/g, '-');
  }

  // create project with unique name enforcement
  static async createProjectWithUniqueName(params: { name: string; description?: string; ownerId: string }): Promise<Project> {
    const nameKey = this.buildNameKey(params.name);
    const projectsCol = collection(db, COLLECTIONS.PROJECTS);
    const indexDocRef = doc(db, COLLECTIONS.PROJECT_NAME_INDEX, nameKey);

    const result = await runTransaction(db, async (tx) => {
      const existing = await tx.get(indexDocRef);
      if (existing.exists()) {
        throw new Error('name taken');
      }

      const now = serverTimestamp() as unknown as Timestamp;
      const projectData: Omit<Project, 'id'> & { nameKey: string } = {
        name: params.name,
        description: params.description || '',
        createdAt: now as any,
        updatedAt: now as any,
        ownerId: params.ownerId,
        isActive: true,
        pastCollaborations: [],
        nameKey
      } as any;

      const projRef = await addDoc(projectsCol, projectData as any);
      tx.set(indexDocRef, { projectId: projRef.id, ownerId: params.ownerId, createdAt: now });

      return { id: projRef.id, ...(projectData as any) } as Project;
    });

    return result;
  }
} 