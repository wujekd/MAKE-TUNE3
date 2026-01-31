import { doc, getDoc, addDoc, updateDoc, deleteDoc, collection, query, where, getDocs, limit as firestoreLimit, Timestamp, setDoc } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import app, { db } from './firebase';
import type { Collaboration, CollaborationDetail, CollaborationId, ProjectId } from '../types/collaboration';
import { COLLECTIONS } from '../types/collaboration';

export class CollaborationService {
  static async createCollaboration(collaboration: Omit<Collaboration, 'id' | 'createdAt' | 'updatedAt'>): Promise<Collaboration> {
    const now = Timestamp.now();
    const collaborationData = {
      ...collaboration,
      tags: collaboration.tags || [],
      tagsKey: collaboration.tagsKey || [],
      backingTrackPath: collaboration.backingTrackPath || '',
      participantIds: [],
      // Initialize counters
      submissionsCount: 0,
      favoritesCount: 0,
      votesCount: 0,
      createdAt: now,
      publishedAt: (collaboration as any).publishedAt || null,
      updatedAt: now
    } as Omit<Collaboration, 'id'>;

    const { submissions, submissionPaths, ...lightData } = collaborationData as any;

    const docRef = await addDoc(collection(db, COLLECTIONS.COLLABORATIONS), lightData);

    // create heavy detail doc with defaults
    await setDoc(doc(db, COLLECTIONS.COLLABORATION_DETAILS, docRef.id), {
      collaborationId: docRef.id,
      submissions: Array.isArray(submissions) ? submissions : [],
      submissionPaths: Array.isArray(submissionPaths) ? submissionPaths : [],
      createdAt: now,
      updatedAt: now
    } satisfies Omit<CollaborationDetail, 'id'>).catch(() => {});

    return { ...(lightData as any), id: docRef.id, submissions: Array.isArray(submissions) ? submissions : [], submissionPaths: Array.isArray(submissionPaths) ? submissionPaths : [] } as Collaboration;
  }

  static async getCollaboration(collaborationId: CollaborationId): Promise<Collaboration | null> {
    const docRef = doc(db, COLLECTIONS.COLLABORATIONS, collaborationId);
    const docSnap = await getDoc(docRef);
    console.log("GET COLLAB TRIGGERED");
    if (!docSnap.exists()) {
      return null;
    }

    return { ...(docSnap.data() as any), id: docSnap.id } as Collaboration;
  }

  static async getCollaborationWithDetails(collaborationId: CollaborationId): Promise<Collaboration | null> {
    const base = await CollaborationService.getCollaboration(collaborationId);
    if (!base) return null;
    console.log("GET COLLAB WITH DETAILS TRIGGERED")
    try {
      const detailRef = doc(db, COLLECTIONS.COLLABORATION_DETAILS, collaborationId);
      const detailSnap = await getDoc(detailRef);
      if (detailSnap.exists()) {
        const detail = detailSnap.data() as CollaborationDetail;
        return {
          ...base,
          submissions: Array.isArray(detail.submissions) ? detail.submissions : (base as any).submissions,
          submissionPaths: Array.isArray(detail.submissionPaths) ? detail.submissionPaths : (base as any).submissionPaths
        } as Collaboration;
      }
    } catch (err) {
      console.log("ERROR KURWA");
    }

    return base;
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
    await Promise.all([
      deleteDoc(refCol),
      deleteDoc(doc(db, COLLECTIONS.COLLABORATION_DETAILS, collaborationId)).catch(() => {})
    ]);
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

  static async publishCollaboration(collaborationId: CollaborationId): Promise<{
    submissionCloseAt: number | null;
    votingCloseAt: number | null;
  }> {
    const functions = getFunctions(app, 'europe-west1');
    const callable = httpsCallable(functions, 'publishCollaboration');
    const response: any = await callable({ collaborationId });
    const data = response?.data ?? {};
    return {
      submissionCloseAt: typeof data.submissionCloseAt === 'number' ? data.submissionCloseAt : null,
      votingCloseAt: typeof data.votingCloseAt === 'number' ? data.votingCloseAt : null
    };
  }

  static filterCollaborationsByTags(collaborations: Collaboration[], tagKeys: string[]): Collaboration[] {
    if (tagKeys.length === 0) return collaborations;
    return collaborations.filter(collab => 
      tagKeys.every(key => collab.tagsKey?.includes(key))
    );
  }
}
