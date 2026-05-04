import { Timestamp } from "firebase-admin/firestore";

const RECOMMENDATION_VISIBLE_STATUSES = new Set([
  "published",
  "submission",
  "voting",
  "completed",
]);

export interface StoredRecommendationItem {
  rank: number;
  collaborationId: string;
  projectId: string;
  score: number;
  highlightedTrackPath: string | null;
}

export interface HydratedRecommendationItem {
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

type RecommendationDocumentData = Record<string, unknown>;
type JoinedDocumentData = Record<string, unknown>;

const toFiniteNumber = (value: unknown): number | null => {
  const num = typeof value === "number" ? value : Number(value);
  return Number.isFinite(num) ? num : null;
};

const toNonEmptyString = (value: unknown): string => {
  return typeof value === "string" ? value.trim() : "";
};

const toIsoString = (value: unknown): string => {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }
  if (value instanceof Timestamp) {
    return value.toDate().toISOString();
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString();
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return new Date(value).toISOString();
  }
  if (value && typeof (value as { toDate?: () => Date }).toDate === "function") {
    const date = (value as { toDate: () => Date }).toDate();
    if (date instanceof Date && !Number.isNaN(date.getTime())) {
      return date.toISOString();
    }
  }
  return "";
};

const toStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter(Boolean);
};

const toMillis = (value: unknown): number | null => {
  if (value instanceof Timestamp) {
    return value.toMillis();
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (value && typeof (value as { toMillis?: () => number }).toMillis === "function") {
    const millis = (value as { toMillis: () => number }).toMillis();
    return Number.isFinite(millis) ? millis : null;
  }
  return null;
};

export const sanitizeStoredRecommendationItems = (
  value: unknown
): StoredRecommendationItem[] => {
  if (!Array.isArray(value)) return [];

  return value
    .map((item): StoredRecommendationItem | null => {
      const rank = toFiniteNumber((item as { rank?: unknown } | null)?.rank);
      const collaborationId = toNonEmptyString((item as { collaborationId?: unknown } | null)?.collaborationId);
      const projectId = toNonEmptyString((item as { projectId?: unknown } | null)?.projectId);
      const score = toFiniteNumber((item as { score?: unknown } | null)?.score);
      const highlightedTrackPathRaw = (item as { highlightedTrackPath?: unknown } | null)?.highlightedTrackPath;
      const highlightedTrackPath = toNonEmptyString(highlightedTrackPathRaw) || null;

      if (!rank || rank < 1 || !collaborationId || !projectId || score === null) {
        return null;
      }

      return {
        rank,
        collaborationId,
        projectId,
        score,
        highlightedTrackPath,
      };
    })
    .filter((item): item is StoredRecommendationItem => Boolean(item))
    .sort((a, b) => a.rank - b.rank);
};

export const getStoredRecommendationItemsFromDoc = (
  recommendationDoc: RecommendationDocumentData
): StoredRecommendationItem[] => {
  const nestedRecommendations = sanitizeStoredRecommendationItems(recommendationDoc.recommendations);
  if (nestedRecommendations.length > 0) {
    return nestedRecommendations;
  }

  return sanitizeStoredRecommendationItems(recommendationDoc.collaborations);
};

export const buildHydratedRecommendationItems = ({
  recommendationDoc,
  collaborationMap,
  projectMap,
}: {
  recommendationDoc: RecommendationDocumentData;
  collaborationMap: Map<string, JoinedDocumentData>;
  projectMap: Map<string, JoinedDocumentData>;
}): HydratedRecommendationItem[] => {
  const generatedAt = toIsoString(recommendationDoc.generatedAt);
  const modelVersion = toNonEmptyString(recommendationDoc.modelVersion);
  const storedItems = getStoredRecommendationItemsFromDoc(recommendationDoc);

  if (!generatedAt || !modelVersion || storedItems.length === 0) {
    return [];
  }

  const items: HydratedRecommendationItem[] = [];

  for (const item of storedItems) {
    const collaboration = collaborationMap.get(item.collaborationId);
    if (!collaboration) continue;

    const collaborationStatus = toNonEmptyString(collaboration.status).toLowerCase();
    if (!RECOMMENDATION_VISIBLE_STATUSES.has(collaborationStatus)) {
      continue;
    }

    const actualProjectId = toNonEmptyString(collaboration.projectId) || item.projectId;
    const project = actualProjectId ? projectMap.get(actualProjectId) : undefined;

    items.push({
      collaborationId: item.collaborationId,
      collaborationName: toNonEmptyString(collaboration.name) || "untitled collaboration",
      collaborationStatus,
      collaborationDescription: toNonEmptyString(collaboration.description),
      collaborationTags: toStringArray(collaboration.tags),
      projectId: actualProjectId,
      projectName: toNonEmptyString(project?.name),
      rank: item.rank,
      score: item.score,
      highlightedTrackPath: item.highlightedTrackPath,
      backingTrackPath: toNonEmptyString(collaboration.backingTrackPath),
      publishedAt: toMillis(collaboration.publishedAt),
      submissionCloseAt: toMillis(collaboration.submissionCloseAt),
      votingCloseAt: toMillis(collaboration.votingCloseAt),
      updatedAt: toMillis(collaboration.updatedAt),
      submissionDurationSeconds: toFiniteNumber(collaboration.submissionDuration),
      votingDurationSeconds: toFiniteNumber(collaboration.votingDuration),
      generatedAt,
      modelVersion,
    });
  }

  return items;
};
