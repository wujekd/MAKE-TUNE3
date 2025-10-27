import { doc, getDoc, addDoc, updateDoc, deleteDoc, collection, query, where, getDocs, limit as firestoreLimit, Timestamp } from 'firebase/firestore';
import { db } from './firebase';
import type { Collaboration, CollaborationId, ProjectId } from '../types/collaboration';
import { COLLECTIONS } from '../types/collaboration';

export class CollaborationService {
  static async createCollaboration(collaboration: Omit<Collaboration, 'id' | 'createdAt' | 'updatedAt'>): Promise<Collaboration> {
    const now = Timestamp.now();
    const collaborationData = {
      ...collaboration,
      tags: collaboration.tags || [],
      tagsKey: collaboration.tagsKey || [],
      createdAt: now,
      publishedAt: (collaboration as any).publishedAt || null,
      updatedAt: now
    } as Omit<Collaboration, 'id'>;

    const docRef = await addDoc(collection(db, COLLECTIONS.COLLABORATIONS), collaborationData as any);
    return { ...(collaborationData as any), id: docRef.id } as Collaboration;
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

  static async getFirstCollaboration(): Promise<Collaboration | null> {
    const q = query(
      collection(db, COLLECTIONS.COLLABORATIONS),
      firestoreLimit(1)
    );
    const snap = await getDocs(q);
    if (snap.empty) return null;
    const d = snap.docs[0];
    return { ...(d.data() as any), id: d.id } as Collaboration;
  }

  static async listPublishedCollaborations(): Promise<Collaboration[]> {
    const q = query(
      collection(db, COLLECTIONS.COLLABORATIONS),
      where('status', '==', 'published')
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ ...(d.data() as any), id: d.id } as Collaboration));
  }

  static async listAllCollaborations(): Promise<Collaboration[]> {
    const q = query(collection(db, COLLECTIONS.COLLABORATIONS));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ ...(d.data() as any), id: d.id } as Collaboration));
  }

  static async getUserCollaborations(userId: string): Promise<Collaboration[]> {
    const q = query(
      collection(db, COLLECTIONS.COLLABORATIONS),
      where('participantIds', 'array-contains', userId)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ ...(d.data() as any), id: d.id } as Collaboration));
  }

  static filterCollaborationsByTags(collaborations: Collaboration[], tagKeys: string[]): Collaboration[] {
    if (tagKeys.length === 0) return collaborations;
    return collaborations.filter(collab => 
      tagKeys.every(key => collab.tagsKey?.includes(key))
    );
  }
}