import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DashboardFeedService } from '../../services/dashboardFeedService';

const hoisted = vi.hoisted(() => ({
  listMyRecommendations: vi.fn(),
  listDashboardCollaborations: vi.fn()
}));

vi.mock('../../services/recommendationService', () => ({
  RecommendationService: {
    listMyRecommendations: hoisted.listMyRecommendations
  }
}));

vi.mock('../../services/collaborationService', () => ({
  CollaborationService: {
    listDashboardCollaborations: hoisted.listDashboardCollaborations
  }
}));

describe('DashboardFeedService', () => {
  beforeEach(() => {
    hoisted.listMyRecommendations.mockReset();
    hoisted.listDashboardCollaborations.mockReset();
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

    const result = await DashboardFeedService.loadFeed({
      mode: 'recommended',
      selectedTags: ['house']
    });

    expect(result.isFallback).toBe(false);
    expect(result.resolvedMode).toBe('recommended');
    expect(result.items).toHaveLength(1);
    expect(result.items[0].collaborationName).toBe('Night Shift');
  });

  it('falls back to the latest feed when recommendations are empty', async () => {
    hoisted.listMyRecommendations.mockResolvedValue([]);
    hoisted.listDashboardCollaborations.mockResolvedValue([
      {
        id: 'collab-2',
        name: 'Fresh Take',
        status: 'submission',
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

    expect(hoisted.listDashboardCollaborations).toHaveBeenCalledWith({
      mode: 'newest',
      limit: 72
    });
    expect(result.isFallback).toBe(true);
    expect(result.resolvedMode).toBe('newest');
    expect(result.items[0].collaborationName).toBe('Fresh Take');
  });
});
