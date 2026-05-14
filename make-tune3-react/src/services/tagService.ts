import { collection, query, orderBy, getDocs, doc, getDoc, where, Timestamp } from 'firebase/firestore';
import { db } from './firebaseDb';
import type { Collaboration, Tag } from '../types/collaboration';
import { COLLECTIONS } from '../types/collaboration';

const DASHBOARD_VISIBLE_STATUSES = ['published', 'submission', 'voting', 'completed'];

export class TagService {
  static async getActiveCollaborationTags(): Promise<Tag[]> {
    const q = query(
      collection(db, COLLECTIONS.COLLABORATIONS),
      where('status', 'in', DASHBOARD_VISIBLE_STATUSES)
    );
    const snap = await getDocs(q);
    const tagCounts = new Map<string, { name: string; count: number }>();

    snap.docs
      .map(d => ({ ...(d.data() as any), id: d.id } as Collaboration))
      .filter(collab => (collab.visibility || 'listed') === 'listed')
      .forEach(collab => {
        const keys = Array.isArray(collab.tagsKey) ? collab.tagsKey : [];
        const names = Array.isArray(collab.tags) ? collab.tags : [];

        keys.forEach((key, index) => {
          const normalizedKey = String(key || '').trim();
          if (!normalizedKey) return;
          const existing = tagCounts.get(normalizedKey);
          tagCounts.set(normalizedKey, {
            name: existing?.name || names[index] || normalizedKey,
            count: (existing?.count || 0) + 1
          });
        });
      });

    const now = Timestamp.now();
    return Array.from(tagCounts.entries())
      .map(([key, tag]) => ({
        key,
        name: tag.name,
        projectCount: 0,
        collaborationCount: tag.count,
        createdAt: now,
        lastUpdatedAt: now
      } as Tag))
      .sort((a, b) => b.collaborationCount - a.collaborationCount || a.name.localeCompare(b.name));
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
