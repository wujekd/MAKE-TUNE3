import { TagUtils } from '../utils/tagUtils';
import { CollaborationService } from './collaborationService';
import { RecommendationService } from './recommendationService';
import type { DashboardRecommendationItem } from './recommendationService';
import type { DashboardCollaborationFeedMode } from './collaborationService';
import type { Collaboration } from '../types/collaboration';
import type { WaveformPreview, WaveformStatus } from '../types/waveform';

export type DashboardFeedMode = 'recommended' | DashboardCollaborationFeedMode;

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
  source: DashboardFeedMode;
}

export interface DashboardFeedResult {
  items: DashboardFeedItem[];
  metaLabel: string;
  requestedMode: DashboardFeedMode;
  resolvedMode: DashboardFeedMode;
  isFallback: boolean;
}

const FEED_LIMIT = 24;
const FETCH_LIMIT = FEED_LIMIT * 3;

const FEED_META: Record<DashboardCollaborationFeedMode, string> = {
  newest: 'newest open collaborations',
  popular: 'most active collaborations by submissions & votes',
  ending_soon: 'submission and voting rounds closing soonest'
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

const buildRecommendationMeta = (items: DashboardRecommendationItem[]): string => {
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

const fallbackMeta = (selectedTags: string[]) => (
  selectedTags.length > 0
    ? 'no recommended matches for the current tags. showing the latest collaboration from each project.'
    : 'showing the latest collaboration from each project.'
);

export class DashboardFeedService {
  static async loadFeed(options: {
    mode: DashboardFeedMode;
    selectedTags?: string[];
  }): Promise<DashboardFeedResult> {
    const normalizedTags = (options.selectedTags || [])
      .map(tag => TagUtils.normalizeTag(tag))
      .filter(Boolean);

    if (options.mode === 'recommended') {
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
      const mappedRecommendations = recItems
        .filter(item => (recCollabMap.get(item.collaborationId)?.visibility || 'listed') === 'listed')
        .map(item => mapRecommendationItem(item, recCollabMap.get(item.collaborationId)))
        .filter(item => matchesTags(item, normalizedTags))
        .slice(0, FEED_LIMIT);

      if (mappedRecommendations.length > 0) {
        return {
          items: mappedRecommendations,
          metaLabel: buildRecommendationMeta(recItems),
          requestedMode: options.mode,
          resolvedMode: 'recommended',
          isFallback: false
        };
      }

      const fallbackItems = normalizedTags.length > 0
        ? await this.loadCollaborationFeed('newest', normalizedTags)
        : await this.loadLatestProjectFallback(normalizedTags);
      return {
        ...fallbackItems,
        metaLabel: fallbackMeta(normalizedTags),
        requestedMode: options.mode,
        isFallback: true
      };
    }

    const feedItems = await this.loadCollaborationFeed(options.mode, normalizedTags);
    return {
      ...feedItems,
      requestedMode: options.mode,
      isFallback: false
    };
  }

  private static async loadCollaborationFeed(
    mode: DashboardCollaborationFeedMode,
    selectedTags: string[]
  ): Promise<Omit<DashboardFeedResult, 'requestedMode' | 'isFallback'>> {
    const collabs = await CollaborationService.listDashboardCollaborations({
      mode,
      limit: FETCH_LIMIT,
      selectedTags
    });

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
  ): Promise<Omit<DashboardFeedResult, 'requestedMode' | 'isFallback'>> {
    const collabs = await CollaborationService.listLatestProjectCollaborations({
      limit: FETCH_LIMIT
    });

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
