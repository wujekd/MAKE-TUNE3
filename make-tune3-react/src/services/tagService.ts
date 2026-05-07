import { collection, query, orderBy, getDocs, doc, getDoc, where } from 'firebase/firestore';
import { db } from './firebaseDb';
import type { Tag } from '../types/collaboration';
import { COLLECTIONS } from '../types/collaboration';

export class TagService {
  static async getActiveCollaborationTags(): Promise<Tag[]> {
    const q = query(
      collection(db, COLLECTIONS.TAGS),
      where('collaborationCount', '>', 0),
      orderBy('collaborationCount', 'desc')
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ ...(d.data() as any), key: d.id } as Tag));
  }

  static async getAllTags(): Promise<Tag[]> {
    const q = query(
      collection(db, COLLECTIONS.TAGS),
      orderBy('name', 'asc')
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ ...(d.data() as any), key: d.id } as Tag));
  }

  static async getTag(tagKey: string): Promise<Tag | null> {
    const docRef = doc(db, COLLECTIONS.TAGS, tagKey);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) return null;
    return { ...(docSnap.data() as any), key: docSnap.id } as Tag;
  }
}
