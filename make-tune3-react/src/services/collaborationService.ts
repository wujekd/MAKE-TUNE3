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
  Timestamp
} from 'firebase/firestore';
import { db } from './firebase';
import type { 
  Project, 
  Collaboration,
  UserCollaboration, 
  UserProfile,
  ProjectId, 
  CollaborationId,
  UserId,
  SubmissionSettings
} from '../types/collaboration';
import { COLLECTIONS } from '../types/collaboration';
import { ProjectService } from './projectService';
import { CollaborationService as CollaborationServiceNew } from './collaborationServiceNew';
import { UserService } from './userService';
import { SubmissionService } from './submissionService';
import { InteractionService } from './interactionService';
import { DataService } from './dataService';

export class CollaborationService {

  static async createProject(project: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>): Promise<Project> {
    return ProjectService.createProject(project);
  }

  static async getProject(projectId: ProjectId): Promise<Project | null> {
    return ProjectService.getProject(projectId);
  }

  static async updateProject(projectId: ProjectId, updates: Partial<Project>): Promise<void> {
    return ProjectService.updateProject(projectId, updates);
  }

  static async deleteProject(projectId: ProjectId): Promise<void> {
    return ProjectService.deleteProject(projectId);
  }

  static async createCollaboration(collaboration: Omit<Collaboration, 'id' | 'createdAt' | 'updatedAt'>): Promise<Collaboration> {
    return CollaborationServiceNew.createCollaboration(collaboration);
  }

  static async uploadBackingTrack(
    file: File,
    collaborationId: string,
    onProgress?: (percent: number) => void
  ): Promise<string> {
    return SubmissionService.uploadBackingTrack(file, collaborationId, onProgress);
  }

  static async hasUserSubmitted(collaborationId: CollaborationId, userId: UserId): Promise<boolean> {
    return SubmissionService.hasUserSubmitted(collaborationId, userId);
  }

  static async uploadSubmission(
    file: File,
    collaborationId: CollaborationId,
    userId: UserId,
    onProgress?: (percent: number) => void,
    settings?: SubmissionSettings
  ): Promise<{ filePath: string; submissionId: string }> {
    return SubmissionService.uploadSubmission(file, collaborationId, userId, onProgress, settings);
  }

  static async getCollaboration(collaborationId: CollaborationId): Promise<Collaboration | null> {
    return CollaborationServiceNew.getCollaboration(collaborationId);
  }

  static async getCollaborationsByProject(projectId: ProjectId): Promise<Collaboration[]> {
    return CollaborationServiceNew.getCollaborationsByProject(projectId);
  }

  static async updateCollaboration(collaborationId: CollaborationId, updates: Partial<Collaboration>): Promise<void> {
    return CollaborationServiceNew.updateCollaboration(collaborationId, updates);
  }

  static async deleteCollaboration(collaborationId: CollaborationId): Promise<void> {
    return CollaborationServiceNew.deleteCollaboration(collaborationId);
  }

  // user Profile Management
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

  // user Collaboration Management
  static async createUserCollaboration(data: Partial<UserCollaboration> & { userId: UserId; collaborationId: CollaborationId }): Promise<void> {
    await addDoc(collection(db, COLLECTIONS.USER_COLLABORATIONS), {
      ...data,
      lastInteraction: Timestamp.now()
    } as any);
  }

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

  // backing download markers
  static async hasDownloadedBacking(userId: UserId, collaborationId: CollaborationId): Promise<boolean> {
    const q = query(
      collection(db, COLLECTIONS.SUBMISSION_USERS),
      where('userId', '==', userId),
      where('collaborationId', '==', collaborationId),
      where('downloadedBacking', '==', true),
      limit(1)
    );
    const snap = await getDocs(q);
    return !snap.empty;
  }

  static async markBackingDownloaded(userId: UserId, collaborationId: CollaborationId, backingPath: string): Promise<void> {
    await addDoc(collection(db, COLLECTIONS.SUBMISSION_USERS), {
      userId,
      collaborationId,
      downloadedBacking: true,
      backingPath,
      downloadedBackingAt: Timestamp.now()
    });
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

    // find the document ID by querying again
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

  static async setSubmissionApproved(): Promise<void> {
    return SubmissionService.setSubmissionApproved();
  }

  static async markTrackAsListened(userId: UserId, collaborationId: CollaborationId, filePath: string): Promise<void> {
    return InteractionService.markTrackAsListened(userId, collaborationId, filePath);
  }

  static async addTrackToFavorites(userId: UserId, collaborationId: CollaborationId, filePath: string): Promise<void> {
    return InteractionService.addTrackToFavorites(userId, collaborationId, filePath);
  }

  static async removeTrackFromFavorites(userId: UserId, collaborationId: CollaborationId, filePath: string): Promise<void> {
    return InteractionService.removeTrackFromFavorites(userId, collaborationId, filePath);
  }

  static async voteForTrack(userId: UserId, collaborationId: CollaborationId, filePath: string): Promise<void> {
    return InteractionService.voteForTrack(userId, collaborationId, filePath);
  }

  static async setListenedRatio(userId: UserId, collaborationId: CollaborationId, ratio: number): Promise<void> {
    return InteractionService.setListenedRatio(userId, collaborationId, ratio);
  }

  static async loadCollaborationData(userId: UserId, collaborationId: CollaborationId): Promise<{
    collaboration: Collaboration | null;
    userCollaboration: UserCollaboration | null;
    userProfile: UserProfile | null;
  }> {
    return DataService.loadCollaborationData(userId, collaborationId);
  }

  static async loadCollaborationDataAnonymous(collaborationId: CollaborationId): Promise<{
    collaboration: Collaboration | null;
  }> {
    return DataService.loadCollaborationDataAnonymous(collaborationId);
  }

  static async getUserCollaborations(userId: UserId): Promise<Collaboration[]> {
    return UserService.getUserCollaborations(userId);
  }

  // get first available collaboration for anonymous users
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

  static async listMySubmissionCollabs(): Promise<Array<{
    projectId: string;
    projectName: string;
    collabId: string;
    collabName: string;
    status: Collaboration['status'];
    submissionCloseAt: number | null;
    votingCloseAt: number | null;
    backingPath: string;
    mySubmissionPath: string;
    winnerPath: string | null;
    submittedAt: number | null;
  }>> {
    return SubmissionService.listMySubmissionCollabs();
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

  static async createProjectWithUniqueName(params: { name: string; description?: string; ownerId: string }): Promise<Project> {
    return ProjectService.createProjectWithUniqueName(params);
  }
} 