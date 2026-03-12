import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebaseDb';
import type { Collaboration, CollaborationId } from '../types/collaboration';
import { COLLECTIONS } from '../types/collaboration';

export interface DashboardCollaborationMeta {
  id: CollaborationId;
  submissionDuration: number;
  votingDuration: number;
  publishedAt: Collaboration['publishedAt'];
  submissionCloseAt?: Collaboration['submissionCloseAt'];
  votingCloseAt?: Collaboration['votingCloseAt'];
  updatedAt: Collaboration['updatedAt'];
}

export class DashboardCollaborationMetaService {
  static async getCollaborationMeta(
    collaborationId: CollaborationId
  ): Promise<DashboardCollaborationMeta | null> {
    const snap = await getDoc(doc(db, COLLECTIONS.COLLABORATIONS, collaborationId));
    if (!snap.exists()) {
      return null;
    }

    const data = snap.data() as Collaboration;
    return {
      id: snap.id,
      submissionDuration: data.submissionDuration,
      votingDuration: data.votingDuration,
      publishedAt: data.publishedAt,
      submissionCloseAt: data.submissionCloseAt,
      votingCloseAt: data.votingCloseAt,
      updatedAt: data.updatedAt
    };
  }
}
