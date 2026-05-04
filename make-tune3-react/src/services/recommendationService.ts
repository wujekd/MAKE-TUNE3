import { auth } from './firebaseAuth';
import { callFirebaseFunction } from './firebaseFunctions';

export interface DashboardRecommendationItem {
  collaborationId: string;
  collaborationName: string;
  collaborationStatus: string;
  collaborationDescription: string;
  collaborationTags: string[];
  projectId: string;
  projectName: string;
  rank: number;
  score: number;
  highlightedTrackPath: string | null;
  backingTrackPath: string;
  publishedAt: number | null;
  submissionCloseAt: number | null;
  votingCloseAt: number | null;
  updatedAt: number | null;
  submissionDurationSeconds: number | null;
  votingDurationSeconds: number | null;
  generatedAt: string;
  modelVersion: string;
}

type GetMyRecommendationsResponse = {
  unauthenticated?: boolean;
  items?: unknown[];
};

const toNumberOrNull = (value: unknown): number | null => (
  typeof value === 'number' && Number.isFinite(value) ? value : null
);

const toStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === 'string');
};

export class RecommendationService {
  static async listMyRecommendations(): Promise<DashboardRecommendationItem[]> {
    if (!auth.currentUser?.uid) {
      console.log('RecommendationService.listMyRecommendations: no authenticated user');
      return [];
    }

    const data = await callFirebaseFunction<Record<string, never>, GetMyRecommendationsResponse>(
      'getMyRecommendations',
      {}
    );

    console.log('RecommendationService.listMyRecommendations: raw response', data);

    if (data?.unauthenticated) {
      console.log('RecommendationService.listMyRecommendations: callable reported unauthenticated');
      return [];
    }

    const items = Array.isArray(data?.items) ? data.items : [];
    const mappedItems = items.map((item) => {
      const row = item as Record<string, unknown>;
      return {
        collaborationId: typeof row.collaborationId === 'string' ? row.collaborationId : '',
        collaborationName: typeof row.collaborationName === 'string' ? row.collaborationName : '',
        collaborationStatus: typeof row.collaborationStatus === 'string' ? row.collaborationStatus : '',
        collaborationDescription: typeof row.collaborationDescription === 'string' ? row.collaborationDescription : '',
        collaborationTags: toStringArray(row.collaborationTags),
        projectId: typeof row.projectId === 'string' ? row.projectId : '',
        projectName: typeof row.projectName === 'string' ? row.projectName : '',
        rank: typeof row.rank === 'number' ? row.rank : 0,
        score: typeof row.score === 'number' ? row.score : 0,
        highlightedTrackPath:
          typeof row.highlightedTrackPath === 'string' ? row.highlightedTrackPath : null,
        backingTrackPath: typeof row.backingTrackPath === 'string' ? row.backingTrackPath : '',
        publishedAt: toNumberOrNull(row.publishedAt),
        submissionCloseAt: toNumberOrNull(row.submissionCloseAt),
        votingCloseAt: toNumberOrNull(row.votingCloseAt),
        updatedAt: toNumberOrNull(row.updatedAt),
        submissionDurationSeconds: toNumberOrNull(row.submissionDurationSeconds),
        votingDurationSeconds: toNumberOrNull(row.votingDurationSeconds),
        generatedAt: typeof row.generatedAt === 'string' ? row.generatedAt : '',
        modelVersion: typeof row.modelVersion === 'string' ? row.modelVersion : ''
      };
    }).filter((item) => Boolean(item.collaborationId));

    console.log('RecommendationService.listMyRecommendations: mapped items', mappedItems);

    return mappedItems;
  }
}
