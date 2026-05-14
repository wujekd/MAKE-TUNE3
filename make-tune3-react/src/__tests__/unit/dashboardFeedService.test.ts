import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DashboardFeedService } from '../../services/dashboardFeedService';

const hoisted = vi.hoisted(() => ({
  listMyRecommendations: vi.fn(),
  listDashboardCollaborations: vi.fn(),
  listLatestProjectCollaborations: vi.fn(),
  getCollaboration: vi.fn()
}));

vi.mock('../../services/recommendationService', () => ({
  RecommendationService: {
    listMyRecommendations: hoisted.listMyRecommendations
  }
}));

vi.mock('../../services/collaborationService', () => ({
  CollaborationService: {
    listDashboardCollaborations: hoisted.listDashboardCollaborations,
    listLatestProjectCollaborations: hoisted.listLatestProjectCollaborations,
    getCollaboration: hoisted.getCollaboration
  }
}));

describe('DashboardFeedService', () => {
  beforeEach(() => {
    hoisted.listMyRecommendations.mockReset();
    hoisted.listDashboardCollaborations.mockReset();
    hoisted.listLatestProjectCollaborations.mockReset();
    hoisted.getCollaboration.mockReset();
  });

  it('returns filtered recommendations when personalized items exist', async () => {
    hoisted.listMyRecommendations.mockResolvedValue([
      {
        collaborationId: 'collab-1',
        collaborationName: 'Night Shift',
        collaborationStatus: 'submission',
        collaborationDescription: 'late session',
        collaborationTags: ['house'],
        projectId: 'project-1',
        projectName: 'Moonlight Project',
        rank: 1,
        score: 0.9123,
        highlightedTrackPath: 'tracks/lead.wav',
        backingTrackPath: 'backings/demo.wav',
        publishedAt: 1700000000000,
        submissionCloseAt: 1700003600000,
        votingCloseAt: 1700007200000,
        updatedAt: 1700001800000,
        submissionDurationSeconds: 3600,
        votingDurationSeconds: 3600,
        generatedAt: '2026-05-04T12:00:00.000Z',
        modelVersion: 'hybrid-v1'
      }
    ]);
    hoisted.getCollaboration.mockResolvedValue(null);

    const result = await DashboardFeedService.loadFeed({
      mode: 'recommended',
      selectedTags: ['house']
    });

    expect(result.isFallback).toBe(false);
    expect(result.resolvedMode).toBe('recommended');
    expect(result.items).toHaveLength(1);
    expect(result.items[0].collaborationName).toBe('Night Shift');
    expect(hoisted.getCollaboration).toHaveBeenCalledWith('collab-1');
  });

  it('falls back to latest project collaborations when recommendations are empty', async () => {
    hoisted.listMyRecommendations.mockResolvedValue([]);
    hoisted.listLatestProjectCollaborations.mockResolvedValue([
      {
        id: 'collab-2',
        name: 'Fresh Take',
        status: 'completed',
        description: 'open now',
        tags: ['garage'],
        tagsKey: ['garage'],
        backingTrackPath: 'backings/fresh.wav',
        projectId: 'project-2',
        submissionDuration: 3600,
        votingDuration: 3600,
        publishedAt: { toMillis: () => 1700000000000 },
        updatedAt: { toMillis: () => 1700001800000 }
      }
    ]);

    const result = await DashboardFeedService.loadFeed({
      mode: 'recommended'
    });

    expect(hoisted.listLatestProjectCollaborations).toHaveBeenCalledWith({
      limit: 72
    });
    expect(result.isFallback).toBe(true);
    expect(result.resolvedMode).toBe('newest');
    expect(result.items[0].collaborationName).toBe('Fresh Take');
    expect(result.items[0].collaborationStatus).toBe('completed');
  });

  it('loads tagged collaborations directly when recommendations have no selected-tag matches', async () => {
    hoisted.listMyRecommendations.mockResolvedValue([]);
    hoisted.listDashboardCollaborations.mockResolvedValue([
      {
        id: 'collab-rare',
        name: 'Rare Groove',
        status: 'submission',
        description: 'tagged result',
        tags: ['Rare Groove'],
        tagsKey: ['rare-groove'],
        backingTrackPath: 'backings/rare.wav',
        projectId: 'project-rare',
        submissionDuration: 3600,
        votingDuration: 3600,
        publishedAt: { toMillis: () => 1700000000000 },
        updatedAt: { toMillis: () => 1700001800000 }
      }
    ]);

    const result = await DashboardFeedService.loadFeed({
      mode: 'recommended',
      selectedTags: ['Rare Groove']
    });

    expect(hoisted.listDashboardCollaborations).toHaveBeenCalledWith({
      mode: 'newest',
      limit: 72,
      selectedTags: ['rare-groove']
    });
    expect(hoisted.listLatestProjectCollaborations).not.toHaveBeenCalled();
    expect(result.isFallback).toBe(true);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].collaborationName).toBe('Rare Groove');
  });
});
