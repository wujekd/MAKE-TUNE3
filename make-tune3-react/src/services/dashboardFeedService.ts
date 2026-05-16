import { TagUtils } from '../utils/tagUtils';
import { CollaborationService } from './collaborationService';
import { RecommendationService } from './recommendationService';
import type { DashboardRecommendationItem } from './recommendationService';
import type { DashboardCollaborationFeedMode } from './collaborationService';
import type { Collaboration } from '../types/collaboration';
import type { WaveformPreview, WaveformStatus } from '../types/waveform';

export type DashboardFeedPriority = 'balanced' | 'for_you' | 'fresh' | 'active' | 'closing';
export type DashboardFeedSource = 'recommended' | DashboardCollaborationFeedMode;
export type DashboardFeedMode = DashboardFeedPriority;

export interface DashboardFeedItem {
  collaborationId: string;
  collaborationName: string;
  collaborationStatus: string;
  collaborationDescription: string;
  collaborationTags: string[];
  collaborationTagsKey: string[];
  projectId: string;
  projectName: string;
  rank: number | null;
  score: number | null;
  highlightedTrackPath: string | null;
  backingTrackPath: string;
  backingWaveformPath: string | null;
  backingWaveformStatus: WaveformStatus | null;
  backingWaveformBucketCount: number | null;
  backingWaveformVersion: number | null;
  backingWaveformPreview: WaveformPreview | null;
  publishedAt: number | null;
  submissionCloseAt: number | null;
  votingCloseAt: number | null;
  completedAt: number | null;
  updatedAt: number | null;
  submissionDurationSeconds: number | null;
  votingDurationSeconds: number | null;
  generatedAt: string;
  modelVersion: string;
  source: DashboardFeedSource;
}

export interface DashboardFeedResult {
  items: DashboardFeedItem[];
  metaLabel: string;
  requestedMode: DashboardFeedPriority;
  resolvedMode: DashboardFeedPriority;
  isFallback: boolean;
}

const FEED_LIMIT = 24;
const FETCH_LIMIT = FEED_LIMIT * 3;
const RECOMMENDATION_TIMEOUT_MS = 900;

const FEED_META: Record<DashboardCollaborationFeedMode, string> = {
  newest: 'newest open collaborations',
  popular: 'most active collaborations by submissions & votes',
  ending_soon: 'submission and voting rounds closing soonest'
};

const PRIORITY_META: Record<DashboardFeedPriority, string> = {
  balanced: 'balanced mix of fresh, active, recommended, and closing collaborations',
  for_you: 'personalized picks boosted into the same discovery stream',
  fresh: 'newer collaborations boosted into the same discovery stream',
  active: 'busy collaborations boosted into the same discovery stream',
  closing: 'submission and voting deadlines boosted into the same discovery stream'
};

const PRIORITY_WEIGHTS: Record<DashboardFeedPriority, {
  recommendation: number;
  fresh: number;
  active: number;
  closing: number;
}> = {
  balanced: { recommendation: 0.34, fresh: 0.28, active: 0.2, closing: 0.18 },
  for_you: { recommendation: 0.58, fresh: 0.18, active: 0.12, closing: 0.12 },
  fresh: { recommendation: 0.22, fresh: 0.52, active: 0.14, closing: 0.12 },
  active: { recommendation: 0.22, fresh: 0.16, active: 0.5, closing: 0.12 },
  closing: { recommendation: 0.22, fresh: 0.16, active: 0.12, closing: 0.5 }
};

type FeedCandidate = {
  item: DashboardFeedItem;
  recommendationScore: number;
  freshScore: number;
  activeScore: number;
  closingScore: number;
  bestRank: number;
};

type SourceFeedResult = {
  items: DashboardFeedItem[];
  metaLabel: string;
  resolvedMode: DashboardFeedSource;
};

const toMillisOrNull = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (value && typeof value === 'object' && typeof (value as any).toMillis === 'function') {
    return (value as any).toMillis();
  }
  return null;
};

const formatGeneratedAt = (value: string): string | null => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString();
};

const buildRecommendationMeta = (items: Array<Pick<DashboardRecommendationItem, 'generatedAt' | 'modelVersion'>>): string => {
  const firstItem = items[0];
  if (!firstItem) {
    return 'personalized picks from your listening and submission activity';
  }

  const generatedAt = formatGeneratedAt(firstItem.generatedAt);
  if (generatedAt && firstItem.modelVersion) {
    return `updated ${generatedAt} · ${firstItem.modelVersion}`;
  }
  if (generatedAt) {
    return `updated ${generatedAt}`;
  }
  if (firstItem.modelVersion) {
    return firstItem.modelVersion;
  }
  return 'personalized picks from your listening and submission activity';
};

const matchesTags = (item: Pick<DashboardFeedItem, 'collaborationTags' | 'collaborationTagsKey'>, selectedTags: string[]) => {
  if (!selectedTags.length) return true;
  const keys = (item.collaborationTagsKey.length > 0 ? item.collaborationTagsKey : item.collaborationTags)
    .map(tag => TagUtils.normalizeTag(tag))
    .filter(Boolean);
  if (!keys.length) return false;
  return selectedTags.every(tag => keys.includes(tag));
};

const mapRecommendationItem = (
  item: DashboardRecommendationItem,
  collab?: Collaboration | null
): DashboardFeedItem => ({
  collaborationId: item.collaborationId,
  collaborationName: collab?.name || item.collaborationName,
  collaborationStatus: collab?.status || item.collaborationStatus,
  collaborationDescription: collab?.description || item.collaborationDescription,
  collaborationTags: Array.isArray(collab?.tags) ? collab.tags : item.collaborationTags,
  collaborationTagsKey: Array.isArray(collab?.tagsKey)
    ? collab.tagsKey
    : item.collaborationTags.map(tag => TagUtils.normalizeTag(tag)).filter(Boolean),
  projectId: collab?.projectId || item.projectId,
  projectName: item.projectName,
  rank: item.rank,
  score: item.score,
  highlightedTrackPath: item.highlightedTrackPath,
  backingTrackPath: collab?.backingTrackPath || item.backingTrackPath,
  backingWaveformPath: collab?.backingWaveformPath || item.backingWaveformPath,
  backingWaveformStatus: collab?.backingWaveformStatus || item.backingWaveformStatus,
  backingWaveformBucketCount: collab?.backingWaveformBucketCount ?? item.backingWaveformBucketCount,
  backingWaveformVersion: collab?.backingWaveformVersion ?? item.backingWaveformVersion,
  backingWaveformPreview: collab?.backingWaveformPreview ?? item.backingWaveformPreview,
  publishedAt: toMillisOrNull(collab?.publishedAt) ?? item.publishedAt,
  submissionCloseAt: toMillisOrNull(collab?.submissionCloseAt) ?? item.submissionCloseAt,
  votingCloseAt: toMillisOrNull(collab?.votingCloseAt) ?? item.votingCloseAt,
  completedAt: toMillisOrNull(collab?.completedAt),
  updatedAt: toMillisOrNull(collab?.updatedAt) ?? item.updatedAt,
  submissionDurationSeconds: item.submissionDurationSeconds,
  votingDurationSeconds: item.votingDurationSeconds,
  generatedAt: item.generatedAt,
  modelVersion: item.modelVersion,
  source: 'recommended'
});

const mapCollaborationItem = (
  collab: Collaboration,
  source: DashboardCollaborationFeedMode
): DashboardFeedItem => ({
  collaborationId: collab.id,
  collaborationName: collab.name || '',
  collaborationStatus: collab.status || '',
  collaborationDescription: collab.description || '',
  collaborationTags: Array.isArray(collab.tags) ? collab.tags : [],
  collaborationTagsKey: Array.isArray(collab.tagsKey) ? collab.tagsKey : [],
  projectId: collab.projectId || '',
  projectName: '',
  rank: null,
  score: null,
  highlightedTrackPath: null,
  backingTrackPath: collab.backingTrackPath || '',
  backingWaveformPath: collab.backingWaveformPath || null,
  backingWaveformStatus: collab.backingWaveformStatus || null,
  backingWaveformBucketCount: collab.backingWaveformBucketCount ?? null,
  backingWaveformVersion: collab.backingWaveformVersion ?? null,
  backingWaveformPreview: collab.backingWaveformPreview ?? null,
  publishedAt: toMillisOrNull(collab.publishedAt),
  submissionCloseAt: toMillisOrNull(collab.submissionCloseAt),
  votingCloseAt: toMillisOrNull(collab.votingCloseAt),
  completedAt: toMillisOrNull(collab.completedAt),
  updatedAt: toMillisOrNull(collab.updatedAt),
  submissionDurationSeconds:
    typeof collab.submissionDuration === 'number' ? collab.submissionDuration : null,
  votingDurationSeconds:
    typeof collab.votingDuration === 'number' ? collab.votingDuration : null,
  generatedAt: '',
  modelVersion: '',
  source
});

const getDeadlineMillis = (item: DashboardFeedItem): number | null => {
  const status = item.collaborationStatus.trim().toLowerCase();
  if (status === 'submission') return item.submissionCloseAt;
  if (status === 'voting') return item.votingCloseAt;
  return null;
};

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

const scoreFreshness = (publishedAt: number | null, updatedAt: number | null, now: number): number => {
  const timestamp = publishedAt || updatedAt || 0;
  if (!timestamp) return 0;
  const ageDays = Math.max(0, (now - timestamp) / 86_400_000);
  return clamp01(1 - (ageDays / 21));
};

const scoreClosing = (deadline: number | null, now: number): number => {
  if (!deadline || deadline <= now) return 0;
  const hours = (deadline - now) / 3_600_000;
  return clamp01(1 - (hours / (7 * 24)));
};

const scoreRecommendation = (item: DashboardFeedItem): number => {
  if (typeof item.score === 'number' && Number.isFinite(item.score) && item.score > 0) {
    return clamp01(item.score);
  }
  if (typeof item.rank === 'number' && Number.isFinite(item.rank) && item.rank > 0) {
    return clamp01(1 - ((item.rank - 1) / FEED_LIMIT));
  }
  return 0;
};

const withTimeout = async <T>(promise: Promise<T>, fallback: T, ms: number): Promise<T> => {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>(resolve => {
        timeoutId = setTimeout(() => resolve(fallback), ms);
      })
    ]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
};

export class DashboardFeedService {
  static async loadFeed(options: {
    mode: DashboardFeedPriority;
    selectedTags?: string[];
    includeRecommendations?: boolean;
  }): Promise<DashboardFeedResult> {
    const normalizedTags = (options.selectedTags || [])
      .map(tag => TagUtils.normalizeTag(tag))
      .filter(Boolean);
    const priority = options.mode || 'balanced';
    const includeRecommendations = options.includeRecommendations !== false;

    const [newestItems, popularItems, endingItems, latestProjectItems, recItems] = await Promise.all([
      this.loadCollaborationFeed('newest', normalizedTags),
      this.loadCollaborationFeed('popular', normalizedTags),
      this.loadCollaborationFeed('ending_soon', normalizedTags),
      this.loadLatestProjectFallback(normalizedTags),
      includeRecommendations
        ? withTimeout(this.loadRecommendationItems(normalizedTags), [], RECOMMENDATION_TIMEOUT_MS)
        : Promise.resolve([] as DashboardFeedItem[])
    ]);

    const allItems = [
      ...newestItems.items,
      ...popularItems.items,
      ...endingItems.items,
      ...latestProjectItems.items,
      ...recItems
    ];
    const items = this.rankHybridItems(allItems, priority).slice(0, FEED_LIMIT);
    const recommendationMeta = recItems.length > 0 ? buildRecommendationMeta(recItems) : null;

    return {
      items,
      metaLabel: recommendationMeta
        ? `${PRIORITY_META[priority]} · ${recommendationMeta}`
        : PRIORITY_META[priority],
      requestedMode: priority,
      resolvedMode: priority,
      isFallback: includeRecommendations && recItems.length === 0
    };
  }

  private static async loadRecommendationItems(selectedTags: string[]): Promise<DashboardFeedItem[]> {
    const recItems = await RecommendationService.listMyRecommendations();
    const recCollabs = await Promise.all(
      recItems.map(item =>
        CollaborationService.getCollaboration(item.collaborationId).catch(() => null)
      )
    );
    const recCollabMap = new Map(
      recCollabs
        .filter((collab): collab is Collaboration => Boolean(collab?.id))
        .map(collab => [collab.id, collab])
    );

    return recItems
      .filter(item => (recCollabMap.get(item.collaborationId)?.visibility || 'listed') === 'listed')
      .map(item => mapRecommendationItem(item, recCollabMap.get(item.collaborationId)))
      .filter(item => matchesTags(item, selectedTags))
      .slice(0, FEED_LIMIT);
  }

  private static rankHybridItems(
    items: DashboardFeedItem[],
    priority: DashboardFeedPriority
  ): DashboardFeedItem[] {
    const now = Date.now();
    const candidates = new Map<string, FeedCandidate>();

    for (const item of items) {
      if (!item.collaborationId || (item.collaborationStatus || '').trim().toLowerCase() === 'unpublished') {
        continue;
      }

      const existing = candidates.get(item.collaborationId);
      const recommendationScore = scoreRecommendation(item);
      const freshScore = scoreFreshness(item.publishedAt, item.updatedAt, now);
      const closingScore = scoreClosing(getDeadlineMillis(item), now);
      const activeScore = item.source === 'popular' ? 1 : 0;
      const bestRank = typeof item.rank === 'number' && item.rank > 0 ? item.rank : Number.MAX_SAFE_INTEGER;

      if (!existing) {
        candidates.set(item.collaborationId, {
          item,
          recommendationScore,
          freshScore,
          activeScore,
          closingScore,
          bestRank
        });
        continue;
      }

      candidates.set(item.collaborationId, {
        item: this.mergeFeedItems(existing.item, item),
        recommendationScore: Math.max(existing.recommendationScore, recommendationScore),
        freshScore: Math.max(existing.freshScore, freshScore),
        activeScore: Math.max(existing.activeScore, activeScore),
        closingScore: Math.max(existing.closingScore, closingScore),
        bestRank: Math.min(existing.bestRank, bestRank)
      });
    }

    const weights = PRIORITY_WEIGHTS[priority];
    return Array.from(candidates.values())
      .sort((a, b) => {
        const scoreA = this.scoreCandidate(a, weights);
        const scoreB = this.scoreCandidate(b, weights);
        if (scoreA !== scoreB) return scoreB - scoreA;
        if (a.bestRank !== b.bestRank) return a.bestRank - b.bestRank;
        return (b.item.publishedAt || b.item.updatedAt || 0) - (a.item.publishedAt || a.item.updatedAt || 0);
      })
      .map(candidate => candidate.item);
  }

  private static scoreCandidate(
    candidate: FeedCandidate,
    weights: typeof PRIORITY_WEIGHTS[DashboardFeedPriority]
  ): number {
    return (
      candidate.recommendationScore * weights.recommendation +
      candidate.freshScore * weights.fresh +
      candidate.activeScore * weights.active +
      candidate.closingScore * weights.closing
    );
  }

  private static mergeFeedItems(existing: DashboardFeedItem, incoming: DashboardFeedItem): DashboardFeedItem {
    if (incoming.source === 'recommended') {
      return {
        ...incoming,
        collaborationName: incoming.collaborationName || existing.collaborationName,
        collaborationDescription: incoming.collaborationDescription || existing.collaborationDescription,
        collaborationTags: incoming.collaborationTags.length > 0 ? incoming.collaborationTags : existing.collaborationTags,
        collaborationTagsKey: incoming.collaborationTagsKey.length > 0 ? incoming.collaborationTagsKey : existing.collaborationTagsKey,
        projectName: incoming.projectName || existing.projectName,
        backingTrackPath: incoming.backingTrackPath || existing.backingTrackPath,
        highlightedTrackPath: incoming.highlightedTrackPath || existing.highlightedTrackPath
      };
    }

    return {
      ...incoming,
      rank: existing.rank ?? incoming.rank,
      score: existing.score ?? incoming.score,
      highlightedTrackPath: existing.highlightedTrackPath || incoming.highlightedTrackPath,
      generatedAt: existing.generatedAt || incoming.generatedAt,
      modelVersion: existing.modelVersion || incoming.modelVersion,
      source: existing.source === 'recommended' ? 'recommended' : incoming.source
    };
  }

  private static async loadCollaborationFeed(
    mode: DashboardCollaborationFeedMode,
    selectedTags: string[]
  ): Promise<SourceFeedResult> {
    const collabs = await CollaborationService.listDashboardCollaborations({
      mode,
      limit: FETCH_LIMIT,
      selectedTags
    }).catch(() => []);

    return {
      items: collabs
        .filter(collab => (collab.visibility || 'listed') === 'listed')
        .map(collab => mapCollaborationItem(collab, mode))
        .filter(item => matchesTags(item, selectedTags))
        .slice(0, FEED_LIMIT),
      metaLabel: FEED_META[mode],
      resolvedMode: mode
    };
  }

  private static async loadLatestProjectFallback(
    selectedTags: string[]
  ): Promise<SourceFeedResult> {
    const collabs = await CollaborationService.listLatestProjectCollaborations({
      limit: FETCH_LIMIT
    }).catch(() => []);

    return {
      items: collabs
        .map(collab => mapCollaborationItem(collab, 'newest'))
        .filter(item => matchesTags(item, selectedTags))
        .slice(0, FEED_LIMIT),
      metaLabel: FEED_META.newest,
      resolvedMode: 'newest'
    };
  }
}
