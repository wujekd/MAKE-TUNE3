import { auth, db } from './firebase';
import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
  limit,
  doc,
  getDoc,
} from 'firebase/firestore';
import { COLLECTIONS } from '../types/collaboration';

type ProjectOverviewItem = {
  projectId: string;
  projectName: string;
  description: string;
  createdAt: number | null;
  updatedAt: number | null;
  currentCollaboration: null | {
    collabId: string;
    name: string;
    status: string;
    publishedAt: number | null;
    submissionCloseAt: number | null;
    votingCloseAt: number | null;
    submissionDuration: number | null;
    votingDuration: number | null;
    backingPath: string;
    updatedAt: number | null;
  };
};

type DownloadSummaryItem = {
  projectId: string;
  projectName: string;
  collabId: string;
  collabName: string;
  status: string;
  submissionCloseAt: number | null;
  votingCloseAt: number | null;
  backingPath: string;
  lastDownloadedAt: number | null;
  downloadCount: number;
};

export class DashboardService {
  static async listMyProjectsOverview(): Promise<ProjectOverviewItem[]> {
    const uid = auth.currentUser?.uid;
    if (!uid) return [];

    const projectsQuery = query(
      collection(db, COLLECTIONS.PROJECTS),
      where('ownerId', '==', uid),
      orderBy('createdAt', 'desc'),
      limit(25)
    );

    const snapshot = await getDocs(projectsQuery).catch(async (err) => {
      if (err?.code === 'failed-precondition') {
        // missing index, fall back to unordered fetch
        const fallbackQuery = query(
          collection(db, COLLECTIONS.PROJECTS),
          where('ownerId', '==', uid),
          limit(25)
        );
        return getDocs(fallbackQuery);
      }
      throw err;
    });

    const raw = snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      data: docSnap.data() as any,
    }));

    raw.sort((a, b) => {
      const aTime = a.data?.createdAt?.toMillis ? a.data.createdAt.toMillis() : 0;
      const bTime = b.data?.createdAt?.toMillis ? b.data.createdAt.toMillis() : 0;
      return bTime - aTime;
    });

    const collabIds = Array.from(
      new Set(
        raw
          .map(({ data }) => String(data.currentCollaborationId || ''))
          .filter(Boolean)
      )
    );

    const collabMap = new Map<string, any>();
    await Promise.all(
      collabIds.map(async (id) => {
        try {
          const snap = await getDoc(doc(db, COLLECTIONS.COLLABORATIONS, id));
          if (snap.exists()) {
            collabMap.set(id, snap.data());
          }
        } catch {
          /* ignore */
        }
      })
    );

    return raw.map(({ id, data }) => {
      const createdAt = data?.createdAt?.toMillis ? data.createdAt.toMillis() : null;
      const updatedAt = data?.updatedAt?.toMillis ? data.updatedAt.toMillis() : null;
      const currentCollabId = String(data.currentCollaborationId || '');
      const current = currentCollabId ? collabMap.get(currentCollabId) || null : null;
      return {
        projectId: id,
        projectName: String(data.name || ''),
        description: String(data.description || ''),
        createdAt,
        updatedAt,
        currentCollaboration: current
          ? {
              collabId: currentCollabId,
              name: String(current.name || ''),
              status: String(current.status || ''),
              publishedAt: current.publishedAt?.toMillis
                ? current.publishedAt.toMillis()
                : null,
              submissionCloseAt: current.submissionCloseAt?.toMillis
                ? current.submissionCloseAt.toMillis()
                : null,
              votingCloseAt: current.votingCloseAt?.toMillis
                ? current.votingCloseAt.toMillis()
                : null,
              submissionDuration:
                typeof current.submissionDuration === 'number'
                  ? current.submissionDuration
                  : null,
              votingDuration:
                typeof current.votingDuration === 'number' ? current.votingDuration : null,
              backingPath: String(current.backingTrackPath || ''),
              updatedAt: current.updatedAt?.toMillis ? current.updatedAt.toMillis() : null,
            }
          : null,
      };
    });
  }

  static async listMyDownloadedCollabs(): Promise<DownloadSummaryItem[]> {
    const uid = auth.currentUser?.uid;
    if (!uid) return [];

    let snapshot;
    try {
      const downloadsQuery = query(
        collection(db, COLLECTIONS.USER_DOWNLOADS),
        where('userId', '==', uid),
        orderBy('lastDownloadedAt', 'desc'),
        limit(20)
      );
      snapshot = await getDocs(downloadsQuery);
    } catch (err) {
      if ((err as any)?.code === 'permission-denied') {
        const fallbackQuery = query(
          collection(db, COLLECTIONS.USER_DOWNLOADS),
          where('userId', '==', uid),
          limit(20)
        );
        snapshot = await getDocs(fallbackQuery);
      } else if ((err as any)?.code === 'failed-precondition') {
        const fallbackQuery = query(
          collection(db, COLLECTIONS.USER_DOWNLOADS),
          where('userId', '==', uid),
          limit(20)
        );
        snapshot = await getDocs(fallbackQuery);
      } else {
        throw err;
      }
    }

    const downloads = snapshot.docs.map((docSnap) => docSnap.data() as any);

    downloads.sort((a, b) => {
      const aTime = a?.lastDownloadedAt?.toMillis ? a.lastDownloadedAt.toMillis() : 0;
      const bTime = b?.lastDownloadedAt?.toMillis ? b.lastDownloadedAt.toMillis() : 0;
      return bTime - aTime;
    });
    const collabIds = Array.from(
      new Set(downloads.map((d) => String(d.collaborationId || '')).filter(Boolean))
    );

    const collabMap = new Map<string, any>();
    await Promise.all(
      collabIds.map(async (id) => {
        try {
          const snap = await getDoc(doc(db, COLLECTIONS.COLLABORATIONS, id));
          if (snap.exists()) {
            collabMap.set(id, snap.data());
          }
        } catch {
          /* ignore */
        }
      })
    );

    const projectIds = Array.from(
      new Set(
        Array.from(collabMap.values())
          .map((collab: any) => String(collab.projectId || ''))
          .filter(Boolean)
      )
    );
    const projectMap = new Map<string, any>();
    await Promise.all(
      projectIds.map(async (id) => {
        try {
          const snap = await getDoc(doc(db, COLLECTIONS.PROJECTS, id));
          if (snap.exists()) {
            projectMap.set(id, snap.data());
          }
        } catch {
          /* ignore */
        }
      })
    );

    return downloads.map((data) => {
      const collabId = String(data.collaborationId || '');
      const collab = collabMap.get(collabId) || {};
      const projectId = String(collab.projectId || '');
      const project = projectMap.get(projectId) || {};
      return {
        projectId,
        projectName: String(project.name || ''),
        collabId,
        collabName: String(collab.name || ''),
        status: String(collab.status || ''),
        submissionCloseAt: collab.submissionCloseAt?.toMillis
          ? collab.submissionCloseAt.toMillis()
          : null,
        votingCloseAt: collab.votingCloseAt?.toMillis
          ? collab.votingCloseAt.toMillis()
          : null,
        backingPath: String(collab.backingTrackPath || ''),
        lastDownloadedAt: data.lastDownloadedAt?.toMillis ? data.lastDownloadedAt.toMillis() : null,
        downloadCount: Number(data.downloadCount || 1),
      };
    });
  }

}

export type { ProjectOverviewItem, DownloadSummaryItem };
