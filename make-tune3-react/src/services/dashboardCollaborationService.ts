import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from './firebaseDb';
import type { Collaboration } from '../types/collaboration';
import { COLLECTIONS } from '../types/collaboration';

export class DashboardCollaborationService {
  static async listPublishedCollaborations(): Promise<Collaboration[]> {
    const q = query(
      collection(db, COLLECTIONS.COLLABORATIONS),
      where('status', 'in', ['published', 'submission', 'voting', 'completed'])
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ ...(d.data() as any), id: d.id } as Collaboration));
  }
}
