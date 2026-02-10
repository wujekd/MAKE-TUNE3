import { collection, query, orderBy, getDocs, doc, getDoc, limit, where } from 'firebase/firestore';
import { db } from './firebase';
import type { Tag } from '../types/collaboration';
import { COLLECTIONS } from '../types/collaboration';

export class TagService {
  static async getPopularTags(limitCount: number = 20): Promise<Tag[]> {
    const q = query(
      collection(db, COLLECTIONS.TAGS),
      where('collaborationCount', '>', 0),
      orderBy('collaborationCount', 'desc'),
      limit(limitCount)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ ...(d.data() as any), key: d.id } as Tag));
  }

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

  static async searchTags(searchTerm: string): Promise<Tag[]> {
    const allTags = await this.getAllTags();
    const normalized = searchTerm.toLowerCase().trim();
    return allTags.filter(t => 
      t.key.includes(normalized) || 
      t.name.toLowerCase().includes(normalized)
    );
  }
}
