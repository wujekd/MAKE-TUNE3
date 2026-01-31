import { doc, getDoc, updateDoc, addDoc, collection, query, where, getDocs, Timestamp, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import type { UserProfile, UserCollaboration, UserId, CollaborationId, ResourceDocType } from '../types/collaboration';
import { COLLECTIONS } from '../types/collaboration';

export class UserService {
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
    
    const docSnap = querySnapshot.docs[0];
    return { ...docSnap.data() } as UserCollaboration;
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

    const q = query(
      collection(db, COLLECTIONS.USER_COLLABORATIONS),
      where('userId', '==', userId),
      where('collaborationId', '==', collaborationId)
    );
    
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      const docRef = querySnapshot.docs[0].ref;
      await updateDoc(docRef, {
        ...updates,
        lastInteraction: Timestamp.now()
      });
    }
  }

  static async hasDownloadedBacking(userId: UserId, collaborationId: CollaborationId): Promise<boolean> {
    return this.hasDownloadedResource(userId, collaborationId, 'backing');
  }

  static async markBackingDownloaded(userId: UserId, collaborationId: CollaborationId, backingPath: string): Promise<void> {
    return this.markResourceDownloaded(userId, collaborationId, 'backing', backingPath);
  }

  static async hasDownloadedResource(
    userId: UserId,
    collaborationId: CollaborationId,
    docType: ResourceDocType
  ): Promise<boolean> {
    const docId = `${userId}__${collaborationId}__${docType}`;
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
