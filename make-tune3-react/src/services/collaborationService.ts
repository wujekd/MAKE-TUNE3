import {
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  getDocs,
  limit as firestoreLimit,
  orderBy,
  Timestamp
} from 'firebase/firestore';
import { db } from './firebaseDb';
import { callFirebaseFunction } from './firebaseFunctions';
import type { Collaboration, CollaborationId, ProjectId } from '../types/collaboration';
import { COLLECTIONS } from '../types/collaboration';

const DEBUG_LOGS = import.meta.env.DEV;

export type DashboardCollaborationFeedMode = 'newest' | 'popular' | 'ending_soon';

const DASHBOARD_OPEN_STATUSES = ['published', 'submission', 'voting'];
const DASHBOARD_VISIBLE_STATUSES = [...DASHBOARD_OPEN_STATUSES, 'completed'];

const mapDocsToCollaborations = (docs: Array<{ id: string; data: () => unknown }>) =>
  docs.map(d => ({ ...(d.data() as any), id: d.id } as Collaboration));

const getNextDeadline = (collab: Collaboration): number => {
  const status = String(collab.status || '').toLowerCase().trim();
  if (status === 'submission' && collab.submissionCloseAt && typeof collab.submissionCloseAt.toMillis === 'function') {
    return collab.submissionCloseAt.toMillis();
  }
  if (status === 'voting' && collab.votingCloseAt && typeof collab.votingCloseAt.toMillis === 'function') {
    return collab.votingCloseAt.toMillis();
  }
  return Number.MAX_SAFE_INTEGER;
};

export class CollaborationService {
  static async createCollaboration(collaboration: Omit<Collaboration, 'id' | 'createdAt' | 'updatedAt'>): Promise<Collaboration> {
    const data = await callFirebaseFunction<any, any>(
      'createCollaborationWithHSD',
      {
        projectId: collaboration.projectId,
        name: collaboration.name,
        description: collaboration.description,
        tags: collaboration.tags || [],
        tagsKey: collaboration.tagsKey || [],
        backingTrackPath: collaboration.backingTrackPath || '',
        submissionDuration: collaboration.submissionDuration,
        votingDuration: collaboration.votingDuration,
        status: collaboration.status || 'unpublished'
      }
    );

    const restoreTimestamp = (val: any) => {
      if (val && typeof val._seconds === 'number') {
        return new Timestamp(val._seconds, val._nanoseconds);
      }
      return val;
    };

    return {
      ...data,
      id: data.id,
      createdAt: restoreTimestamp(data.createdAt),
      updatedAt: restoreTimestamp(data.updatedAt),
      publishedAt: restoreTimestamp(data.publishedAt),
      submissionCloseAt: restoreTimestamp(data.submissionCloseAt),
      votingCloseAt: restoreTimestamp(data.votingCloseAt),
      completedAt: restoreTimestamp(data.completedAt)
    } as Collaboration;
  }

  static async getCollaboration(collaborationId: CollaborationId): Promise<Collaboration | null> {
    const docRef = doc(db, COLLECTIONS.COLLABORATIONS, collaborationId);
    const docSnap = await getDoc(docRef);
    if (DEBUG_LOGS) console.log("GET COLLAB TRIGGERED");
    if (!docSnap.exists()) {
      return null;
    }

    return { ...(docSnap.data() as any), id: docSnap.id } as Collaboration;
  }

  static async getCollaborationWithDetails(collaborationId: CollaborationId): Promise<Collaboration | null> {
    // Use cloud function for server-side filtering of submissions
    try {
      const data = await callFirebaseFunction<{ collaborationId: CollaborationId }, { collaboration?: Collaboration }>(
        'getCollaborationData',
        { collaborationId }
      );
      if (data?.collaboration) {
        if (DEBUG_LOGS) console.log("GET COLLAB WITH DETAILS via cloud function");
        return data.collaboration as Collaboration;
      }
      return null;
    } catch (err) {
      console.log("Cloud function failed, falling back to direct read", err);
      // Fallback to base collaboration only (no direct detail read)
      return CollaborationService.getCollaboration(collaborationId);
    }
  }

  /**
   * Get collaboration data for moderation - returns only pending submissions.
   * Only accessible by project owner.
   */
  static async getCollaborationForModeration(collaborationId: CollaborationId): Promise<Collaboration | null> {
    try {
      const data = await callFirebaseFunction<{ collaborationId: CollaborationId }, { collaboration?: Collaboration }>(
        'getModerationData',
        { collaborationId }
      );
      if (data?.collaboration) {
        if (DEBUG_LOGS) console.log("GET COLLAB FOR MODERATION via cloud function");
        return data.collaboration as Collaboration;
      }
      return null;
    } catch (err) {
      console.error("getModerationData failed", err);
      throw err;
    }
  }

  static async getCollaborationsByProject(projectId: ProjectId): Promise<Collaboration[]> {
    const q = query(
      collection(db, COLLECTIONS.COLLABORATIONS),
      where('projectId', '==', projectId)
    );

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(d => ({ ...(d.data() as any), id: d.id }) as Collaboration);
  }

  static async getPublishedCollaborationsByProject(projectId: ProjectId): Promise<Collaboration[]> {
    const q = query(
      collection(db, COLLECTIONS.COLLABORATIONS),
      where('projectId', '==', projectId),
      where('status', 'in', ['published', 'submission', 'voting', 'completed'])
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
      deleteDoc(doc(db, COLLECTIONS.COLLABORATION_DETAILS, collaborationId)).catch(() => { })
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
      where('status', 'in', ['published', 'submission', 'voting', 'completed'])
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ ...(d.data() as any), id: d.id } as Collaboration));
  }

  static async listDashboardCollaborations(options: {
    mode: DashboardCollaborationFeedMode;
    limit?: number;
  }): Promise<Collaboration[]> {
    const pageSize = Math.max(1, Math.min(100, Number(options.limit) || 24));

    if (options.mode === 'popular') {
      const snap = await getDocs(query(
        collection(db, COLLECTIONS.COLLABORATIONS),
        where('status', 'in', DASHBOARD_OPEN_STATUSES),
        orderBy('publishedAt', 'desc'),
        firestoreLimit(pageSize * 3)
      ));
      const collabs = mapDocsToCollaborations(snap.docs);
      return collabs
        .sort((a, b) => ((b.submissionsCount || 0) + (b.votesCount || 0)) - ((a.submissionsCount || 0) + (a.votesCount || 0)))
        .slice(0, pageSize);
    }

    if (options.mode === 'ending_soon') {
      const [submissionSnap, votingSnap] = await Promise.all([
        getDocs(query(
          collection(db, COLLECTIONS.COLLABORATIONS),
          where('status', '==', 'submission'),
          orderBy('submissionCloseAt', 'asc'),
          firestoreLimit(pageSize)
        )),
        getDocs(query(
          collection(db, COLLECTIONS.COLLABORATIONS),
          where('status', '==', 'voting'),
          orderBy('votingCloseAt', 'asc'),
          firestoreLimit(pageSize)
        ))
      ]);

      const merged = [...mapDocsToCollaborations(submissionSnap.docs), ...mapDocsToCollaborations(votingSnap.docs)];
      const deduped = Array.from(new Map(merged.map(collab => [collab.id, collab])).values());
      return deduped
        .sort((a, b) => getNextDeadline(a) - getNextDeadline(b))
        .slice(0, pageSize);
    }

    const snap = await getDocs(query(
      collection(db, COLLECTIONS.COLLABORATIONS),
      where('status', 'in', DASHBOARD_OPEN_STATUSES),
      orderBy('publishedAt', 'desc'),
      firestoreLimit(pageSize)
    ));
    return mapDocsToCollaborations(snap.docs);
  }

  static async listLatestProjectCollaborations(options: {
    limit?: number;
  } = {}): Promise<Collaboration[]> {
    const pageSize = Math.max(1, Math.min(100, Number(options.limit) || 24));
    const snap = await getDocs(query(
      collection(db, COLLECTIONS.COLLABORATIONS),
      where('status', 'in', DASHBOARD_VISIBLE_STATUSES),
      orderBy('publishedAt', 'desc'),
      firestoreLimit(Math.min(100, pageSize * 4))
    ));
    const collabs = mapDocsToCollaborations(snap.docs);
    const latestByProject = new Map<string, Collaboration>();

    for (const collab of collabs) {
      const projectKey = collab.projectId || collab.id;
      if (!latestByProject.has(projectKey)) {
        latestByProject.set(projectKey, collab);
      }
    }

    return Array.from(latestByProject.values()).slice(0, pageSize);
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
    const data = await callFirebaseFunction<
      { collaborationId: CollaborationId },
      { submissionCloseAt?: number; votingCloseAt?: number }
    >('publishCollaboration', { collaborationId });
    return {
      submissionCloseAt: typeof data.submissionCloseAt === 'number' ? data.submissionCloseAt : null,
      votingCloseAt: typeof data.votingCloseAt === 'number' ? data.votingCloseAt : null
    };
  }

  static async listMyModerationQueue(): Promise<Array<{ id: string; name: string; projectId: string | null }>> {
    const data = await callFirebaseFunction<Record<string, never>, { items?: Array<{ id: string; name: string; projectId: string | null }> }>(
      'getMyModerationQueue',
      {}
    );
    return data?.items || [];
  }
}
