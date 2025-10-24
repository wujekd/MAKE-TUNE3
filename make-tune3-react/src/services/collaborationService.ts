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
import app, { db, storage } from './firebase';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { ref, uploadBytesResumable, type UploadTaskSnapshot } from 'firebase/storage';
import { DEBUG_ALLOW_MULTIPLE_SUBMISSIONS, MAX_SUBMISSION_FILE_SIZE } from '../config';
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

  static async uploadBackingTrack(
    file: File,
    collaborationId: string,
    onProgress?: (percent: number) => void
  ): Promise<string> {
    
    if (file.size >= MAX_SUBMISSION_FILE_SIZE) {
      throw new Error(`File too large. Maximum size is ${Math.round(MAX_SUBMISSION_FILE_SIZE / 1024 / 1024)}MB.`);
    }
    const ext = this.getPreferredAudioExtension(file);
    const path = `collabs/${collaborationId}/backing.${ext}`;
    const r = ref(storage, path);
    const task = uploadBytesResumable(r, file, { contentType: file.type });
    await new Promise<void>((resolve, reject) => {
      task.on(
        'state_changed',
        (snap) => {
          if (onProgress) {
            const pct = (snap.bytesTransferred / snap.totalBytes) * 100;
            onProgress(Math.round(pct));
          }
        },
        (err) => reject(err),
        () => resolve()
      );
    });
    return path;
  }

  static async hasUserSubmitted(collaborationId: CollaborationId, userId: UserId): Promise<boolean> {
    if (DEBUG_ALLOW_MULTIPLE_SUBMISSIONS) return false;
    const collabRef = doc(db, COLLECTIONS.COLLABORATIONS, collaborationId);
    const snap = await getDoc(collabRef);
    const data = snap.exists() ? (snap.data() as Collaboration) : null;
    const list = (data && Array.isArray((data as any).participantIds)) ? (data as any).participantIds as string[] : [];
    return list.includes(userId);
  }

  static async uploadSubmission(
    file: File,
    collaborationId: CollaborationId,
    userId: UserId,
    onProgress?: (percent: number) => void,
    settings?: SubmissionSettings
  ): Promise<{ filePath: string; submissionId: string }> {
    
    if (file.size >= MAX_SUBMISSION_FILE_SIZE) {
      throw new Error(`File too large. Maximum size is ${Math.round(MAX_SUBMISSION_FILE_SIZE / 1024 / 1024)}MB.`);
    }
    const exists = await this.hasUserSubmitted(collaborationId, userId);
    if (exists) {
      throw new Error('already submitted');
    }
    const ext = this.getPreferredAudioExtension(file);
    const submissionId = (typeof crypto !== 'undefined' && (crypto as any).randomUUID) ? (crypto as any).randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const path = `collabs/${collaborationId}/submissions/${submissionId}.${ext}`;
    const r = ref(storage, path);
    const task = uploadBytesResumable(r, file, { contentType: file.type, customMetadata: { ownerUid: userId } });
    const uploaded: UploadTaskSnapshot = await new Promise((resolve, reject) => {
      task.on(
        'state_changed',
        (snap) => {
          const pct = (snap.bytesTransferred / snap.totalBytes) * 100;
          if (onProgress) onProgress(Math.round(pct));
        },
        (err) => reject(err),
        () => resolve(task.snapshot)
      );
    });
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
      contentType: uploaded.metadata.contentType || file.type,
      size: uploaded.metadata.size || file.size,
      createdAt
    });

    const collabSnap = await getDoc(collabRef);
    if (collabSnap.exists()) {
      const data = collabSnap.data() as Collaboration;
      const needsMod = data.requiresModeration ? true : ((data as any).unmoderatedSubmissions === true);
      const entry = {
        path,
        settings: settings ?? {
          eq: {
            highshelf: { gain: 0, frequency: 8000 },
            param2: { gain: 0, frequency: 3000, Q: 1 },
            param1: { gain: 0, frequency: 250, Q: 1 },
            highpass: { frequency: 20, enabled: false }
          },
          volume: { gain: 1 }
        }
      } as any;
      await updateDoc(collabRef, { submissions: arrayUnion(entry), updatedAt: Timestamp.now(), unmoderatedSubmissions: needsMod });
      // temporary dual-write for backward compatibility
      await updateDoc(collabRef, { submissionPaths: arrayUnion(path) }).catch(() => {});
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

  static async deleteCollaboration(collaborationId: CollaborationId): Promise<void> {
    const refCol = doc(db, COLLECTIONS.COLLABORATIONS, collaborationId);
    await deleteDoc(refCol);
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

  // moderation
  static async setSubmissionApproved(): Promise<void> {
    // TODO 
    // using file paths model: update collaboration  submissionPaths is notneeded for approval flag.
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
      // update existing collaboration
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
      // create new collaboration
      await this.createUserCollaboration({
        userId,
        collaborationId,
        listenedTracks: [],
        favoriteTracks: [filePath],
        finalVote: null,
        listenedRatio: 7
      });
    } else {
      // updejtcollab
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
      // update collaboration
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

  // load collaboration data for anonymous users (no user-specific data)
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

  // get user's collaboration list
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

  // list my recent submission collaborations via callable CF
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
    const functions = getFunctions(app, 'europe-west1');
    const getMine = httpsCallable(functions, 'getMySubmissionCollabs');
    const res: any = await getMine({});
    const data = (res?.data as any) || {};
    if (data?.unauthenticated) return [];
    return Array.isArray(data.items) ? data.items : [];
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
    const functions = getFunctions(app, 'europe-west1');
    const createProject = httpsCallable(functions, 'createProjectWithUniqueName');
    try {
      const res: any = await createProject({ name: params.name, description: params.description || '' });
      const data = res?.data as any;
      if (data?.id) {
        const ref = doc(db, COLLECTIONS.PROJECTS, data.id);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          return { ...(snap.data() as any), id: snap.id } as Project;
        }
        return {
          id: data.id,
          name: params.name,
          description: params.description || '',
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
          ownerId: params.ownerId,
          isActive: true,
          pastCollaborations: []
        } as any;
      }
      throw new Error('failed to create');
    } catch (e: any) {
      if (e?.code === 'functions/already-exists' || /name taken/i.test(e?.message || '')) {
        throw new Error('Name already taken. Please choose a different name.');
      }
      throw e;
    }
  }
} 