import { doc, getDoc, updateDoc, addDoc, collection, query, where, getDocs, Timestamp, setDoc, limit, type DocumentReference } from 'firebase/firestore';
import { db } from './firebaseDb';
import type { UserProfile, UserCollaboration, UserId, CollaborationId, ResourceDocType } from '../types/collaboration';
import { COLLECTIONS } from '../types/collaboration';

const normalizeUserCollaboration = (data: Record<string, any>): UserCollaboration => ({
  ...data,
  listenedTracks: Array.isArray(data.listenedTracks) ? data.listenedTracks : [],
  likedTracks: Array.isArray(data.likedTracks) ? data.likedTracks : [],
  favoriteTracks: Array.isArray(data.favoriteTracks) ? data.favoriteTracks : [],
  likedCollaboration: Boolean(data.likedCollaboration),
  favoritedCollaboration: Boolean(data.favoritedCollaboration),
  finalVote: typeof data.finalVote === 'string' ? data.finalVote : null,
  listenedRatio: typeof data.listenedRatio === 'number' ? data.listenedRatio : 0
}) as UserCollaboration;

type UserCollaborationRecord = {
  docRef: DocumentReference;
  data: UserCollaboration;
};

const buildUserCollaborationQuery = (userId: UserId, collaborationId: CollaborationId) =>
  query(
    collection(db, COLLECTIONS.USER_COLLABORATIONS),
    where('userId', '==', userId),
    where('collaborationId', '==', collaborationId),
    limit(1)
  );

export class UserService {
  private static async findUserCollaborationRecord(
    userId: UserId,
    collaborationId: CollaborationId
  ): Promise<UserCollaborationRecord | null> {
    const querySnapshot = await getDocs(buildUserCollaborationQuery(userId, collaborationId));
    if (querySnapshot.empty) {
      return null;
    }

    const docSnap = querySnapshot.docs[0];
    return {
      docRef: docSnap.ref,
      data: normalizeUserCollaboration(docSnap.data() as Record<string, any>)
    };
  }

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

  static async createUserCollaboration(data: Partial<UserCollaboration> & { userId: UserId; collaborationId: CollaborationId }): Promise<void> {
    await addDoc(collection(db, COLLECTIONS.USER_COLLABORATIONS), {
      ...data,
      lastInteraction: Timestamp.now()
    } as any);
  }

  static async getUserCollaboration(userId: UserId, collaborationId: CollaborationId): Promise<UserCollaboration | null> {
    const record = await this.findUserCollaborationRecord(userId, collaborationId);
    return record?.data ?? null;
  }

  static async updateUserCollaboration(
    userId: UserId, 
    collaborationId: CollaborationId, 
    updates: Partial<UserCollaboration>
  ): Promise<void> {
    const record = await this.findUserCollaborationRecord(userId, collaborationId);
    if (!record) {
      throw new Error('User collaboration not found');
    }

    await updateDoc(record.docRef, {
      ...updates,
      lastInteraction: Timestamp.now()
    });
  }

  static async upsertUserCollaboration(
    userId: UserId,
    collaborationId: CollaborationId,
    updates: Partial<Pick<UserCollaboration, 'listenedTracks' | 'listenedRatio'>>
  ): Promise<void> {
    const record = await this.findUserCollaborationRecord(userId, collaborationId);
    if (record) {
      await updateDoc(record.docRef, {
        ...updates,
        lastInteraction: Timestamp.now()
      });
      return;
    }

    await addDoc(collection(db, COLLECTIONS.USER_COLLABORATIONS), {
      userId,
      collaborationId,
      ...updates,
      lastInteraction: Timestamp.now()
    } as any);
  }

  static async addListenedTrack(
    userId: UserId,
    collaborationId: CollaborationId,
    filePath: string
  ): Promise<void> {
    const record = await this.findUserCollaborationRecord(userId, collaborationId);
    if (!record) {
      await addDoc(collection(db, COLLECTIONS.USER_COLLABORATIONS), {
        userId,
        collaborationId,
        listenedTracks: [filePath],
        lastInteraction: Timestamp.now()
      } as any);
      return;
    }

    const listenedTracks = [...(record.data.listenedTracks || [])];
    if (listenedTracks.includes(filePath)) {
      return;
    }

    listenedTracks.push(filePath);
    await updateDoc(record.docRef, {
      listenedTracks,
      lastInteraction: Timestamp.now()
    });
  }

  static async hasDownloadedBacking(userId: UserId, collaborationId: CollaborationId): Promise<boolean> {
    const docId = `${userId}__${collaborationId}__backing`;
    const ref = doc(db, COLLECTIONS.USER_DOWNLOADS, docId);
    const snap = await getDoc(ref);
    return snap.exists();
  }

  static async markResourceDownloaded(
    userId: UserId,
    collaborationId: CollaborationId,
    docType: ResourceDocType,
    path: string
  ): Promise<void> {
    const docId = `${userId}__${collaborationId}__${docType}`;
    const ref = doc(db, COLLECTIONS.USER_DOWNLOADS, docId);
    const existing = await getDoc(ref);
    const downloadCount = existing.exists() ? (((existing.data() as any)?.downloadCount || 0) + 1) : 1;
    await setDoc(ref, {
      userId,
      collaborationId,
      docType,
      path,
      downloadCount,
      lastDownloadedAt: Timestamp.now()
    }, { merge: true });
  }

  static async getUserCollaborations(userId: UserId): Promise<any[]> {
    const userProfile = await this.getUserProfile(userId);
    if (!userProfile || !userProfile.collaborationIds || userProfile.collaborationIds.length === 0) {
      return [];
    }

    const q = query(
      collection(db, COLLECTIONS.COLLABORATIONS),
      where('__name__', 'in', userProfile.collaborationIds)
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ ...(doc.data() as any), id: doc.id }));
  }
}
