import { auth } from './firebaseAuth';
import { callFirebaseFunction } from './firebaseFunctions';

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
  publishedAt: number | null;
  submissionCloseAt: number | null;
  votingCloseAt: number | null;
  submissionDuration: number | null;
  votingDuration: number | null;
  backingPath: string;
  lastDownloadedAt: number | null;
  downloadCount: number;
  updatedAt: number | null;
};

type MyAccountStats = {
  collabs: number;
  active: number;
  submissions: number;
  votes: number;
};

type DashboardStats = {
  totalCollabs: number;
  totalSubmissions: number;
  totalVotes: number;
  activeCollabs: number;
};

export class DashboardService {
  static async listMyProjectsOverview(): Promise<ProjectOverviewItem[]> {
    const uid = auth.currentUser?.uid;
    if (!uid) return [];

    try {
      const data = await callFirebaseFunction<
        Record<string, never>,
        { items?: any[]; unauthenticated?: boolean }
      >('getMyProjectsOverview', {});

      if (data?.unauthenticated) return [];

      const items: any[] = Array.isArray(data.items) ? data.items : [];
      return items.map((item) => ({
        projectId: typeof item?.projectId === 'string' ? item.projectId : '',
        projectName: typeof item?.projectName === 'string' ? item.projectName : '',
        description: typeof item?.description === 'string' ? item.description : '',
        createdAt: typeof item?.createdAt === 'number' ? item.createdAt : null,
        updatedAt: typeof item?.updatedAt === 'number' ? item.updatedAt : null,
        currentCollaboration: item?.currentCollaboration
          ? {
              collabId: typeof item.currentCollaboration.collabId === 'string' ? item.currentCollaboration.collabId : '',
              name: typeof item.currentCollaboration.name === 'string' ? item.currentCollaboration.name : '',
              status: typeof item.currentCollaboration.status === 'string' ? item.currentCollaboration.status : '',
              publishedAt: typeof item.currentCollaboration.publishedAt === 'number' ? item.currentCollaboration.publishedAt : null,
              submissionCloseAt: typeof item.currentCollaboration.submissionCloseAt === 'number' ? item.currentCollaboration.submissionCloseAt : null,
              votingCloseAt: typeof item.currentCollaboration.votingCloseAt === 'number' ? item.currentCollaboration.votingCloseAt : null,
              submissionDuration: typeof item.currentCollaboration.submissionDuration === 'number' ? item.currentCollaboration.submissionDuration : null,
              votingDuration: typeof item.currentCollaboration.votingDuration === 'number' ? item.currentCollaboration.votingDuration : null,
              backingPath: typeof item.currentCollaboration.backingPath === 'string' ? item.currentCollaboration.backingPath : '',
              updatedAt: typeof item.currentCollaboration.updatedAt === 'number' ? item.currentCollaboration.updatedAt : null,
            }
          : null,
      }));
    } catch {
      return [];
    }
  }

  static async listMyDownloadedCollabs(): Promise<DownloadSummaryItem[]> {
    const uid = auth.currentUser?.uid;
    if (!uid) return [];

    try {
      const data = await callFirebaseFunction<
        Record<string, never>,
        { items?: any[]; unauthenticated?: boolean }
      >('getMyDownloadedCollabs', {});

      if (data?.unauthenticated) return [];

      const items: any[] = Array.isArray(data.items) ? data.items : [];
      return items.map((item) => ({
        projectId: typeof item?.projectId === 'string' ? item.projectId : '',
        projectName: typeof item?.projectName === 'string' ? item.projectName : '',
        collabId: typeof item?.collabId === 'string' ? item.collabId : '',
        collabName: typeof item?.collabName === 'string' ? item.collabName : '',
        status: typeof item?.status === 'string' ? item.status : '',
        publishedAt: typeof item?.publishedAt === 'number' ? item.publishedAt : null,
        submissionCloseAt: typeof item?.submissionCloseAt === 'number' ? item.submissionCloseAt : null,
        votingCloseAt: typeof item?.votingCloseAt === 'number' ? item.votingCloseAt : null,
        submissionDuration: typeof item?.submissionDuration === 'number' ? item.submissionDuration : null,
        votingDuration: typeof item?.votingDuration === 'number' ? item.votingDuration : null,
        backingPath: typeof item?.backingPath === 'string' ? item.backingPath : '',
        lastDownloadedAt: typeof item?.lastDownloadedAt === 'number' ? item.lastDownloadedAt : null,
        downloadCount: Number(item?.downloadCount || 1),
        updatedAt: typeof item?.updatedAt === 'number' ? item.updatedAt : null,
      }));
    } catch {
      return [];
    }
  }

  static async getMyAccountStats(): Promise<MyAccountStats> {
    const uid = auth.currentUser?.uid;
    if (!uid) {
      return {
        collabs: 0,
        active: 0,
        submissions: 0,
        votes: 0
      };
    }

    try {
      const data = await callFirebaseFunction<Record<string, never>, Partial<MyAccountStats>>(
        'getMyAccountStats',
        {}
      );

      return {
        collabs: Number(data.collabs || 0),
        active: Number(data.active || 0),
        submissions: Number(data.submissions || 0),
        votes: Number(data.votes || 0)
      };
    } catch {
      return {
        collabs: 0,
        active: 0,
        submissions: 0,
        votes: 0
      };
    }
  }

  static async getDashboardStats(): Promise<DashboardStats> {
    try {
      const data = await callFirebaseFunction<
        Record<string, never>,
        Partial<DashboardStats>
      >('getDashboardStats', {});

      return {
        totalCollabs: Number(data.totalCollabs || 0),
        totalSubmissions: Number(data.totalSubmissions || 0),
        totalVotes: Number(data.totalVotes || 0),
        activeCollabs: Number(data.activeCollabs || 0)
      };
    } catch {
      return {
        totalCollabs: 0,
        totalSubmissions: 0,
        totalVotes: 0,
        activeCollabs: 0
      };
    }
  }

}

export type { ProjectOverviewItem, DownloadSummaryItem, MyAccountStats, DashboardStats };
