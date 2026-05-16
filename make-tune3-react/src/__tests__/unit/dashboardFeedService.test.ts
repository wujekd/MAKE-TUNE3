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
    hoisted.listDashboardCollaborations.mockResolvedValue([]);
    hoisted.listLatestProjectCollaborations.mockResolvedValue([]);
    hoisted.listMyRecommendations.mockResolvedValue([]);
    hoisted.getCollaboration.mockResolvedValue(null);
  });

  it('boosts personalized items inside the hybrid stream when they exist', async () => {
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
      mode: 'for_you',
      selectedTags: ['house']
    });

    expect(result.isFallback).toBe(false);
    expect(result.resolvedMode).toBe('for_you');
    expect(result.items).toHaveLength(1);
    expect(result.items[0].collaborationName).toBe('Night Shift');
    expect(result.items[0].source).toBe('recommended');
    expect(hoisted.getCollaboration).toHaveBeenCalledWith('collab-1');
  });

  it('still returns a hybrid stream when recommendations are empty', async () => {
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
      mode: 'balanced'
    });

    expect(hoisted.listLatestProjectCollaborations).toHaveBeenCalledWith({
      limit: 72
    });
    expect(result.isFallback).toBe(true);
    expect(result.resolvedMode).toBe('balanced');
    expect(result.items[0].collaborationName).toBe('Fresh Take');
    expect(result.items[0].collaborationStatus).toBe('completed');
  });

  it('loads tagged collaborations into the hybrid stream when recommendations have no selected-tag matches', async () => {
    hoisted.listDashboardCollaborations.mockImplementation(({ mode }) => Promise.resolve(
      mode === 'newest'
        ? [
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
          ]
        : []
    ));

    const result = await DashboardFeedService.loadFeed({
      mode: 'balanced',
      selectedTags: ['Rare Groove']
    });

    expect(hoisted.listDashboardCollaborations).toHaveBeenCalledWith({
      mode: 'newest',
      limit: 72,
      selectedTags: ['rare-groove']
    });
    expect(result.isFallback).toBe(true);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].collaborationName).toBe('Rare Groove');
  });

  it('changes ordering when a different hybrid priority is selected', async () => {
    hoisted.listDashboardCollaborations.mockImplementation(({ mode }) => Promise.resolve(
      mode === 'ending_soon'
        ? [
            {
              id: 'collab-closing',
              name: 'Last Call',
              status: 'submission',
              description: 'closing soon',
              tags: ['house'],
              tagsKey: ['house'],
              backingTrackPath: 'backings/closing.wav',
              projectId: 'project-closing',
              submissionDuration: 3600,
              votingDuration: 3600,
              publishedAt: { toMillis: () => Date.now() - 20 * 86_400_000 },
              updatedAt: { toMillis: () => Date.now() - 20 * 86_400_000 },
              submissionCloseAt: { toMillis: () => Date.now() + 60 * 60_000 }
            }
          ]
        : [
            {
              id: 'collab-fresh',
              name: 'Fresh Air',
              status: 'submission',
              description: 'brand new',
              tags: ['house'],
              tagsKey: ['house'],
              backingTrackPath: 'backings/fresh.wav',
              projectId: 'project-fresh',
              submissionDuration: 3600,
              votingDuration: 3600,
              publishedAt: { toMillis: () => Date.now() },
              updatedAt: { toMillis: () => Date.now() },
              submissionCloseAt: { toMillis: () => Date.now() + 6 * 86_400_000 }
            }
          ]
    ));

    const fresh = await DashboardFeedService.loadFeed({ mode: 'fresh' });
    const closing = await DashboardFeedService.loadFeed({ mode: 'closing' });

    expect(fresh.items[0].collaborationName).toBe('Fresh Air');
    expect(closing.items[0].collaborationName).toBe('Last Call');
  });
});
