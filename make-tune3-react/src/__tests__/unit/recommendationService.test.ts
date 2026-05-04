import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RecommendationService } from '../../services/recommendationService';

const hoisted = vi.hoisted(() => ({
  callFirebaseFunction: vi.fn(),
  auth: {
    currentUser: { uid: 'user-1' as string | undefined }
  }
}));

vi.mock('../../services/firebaseFunctions', () => ({
  callFirebaseFunction: hoisted.callFirebaseFunction
}));

vi.mock('../../services/firebaseAuth', () => ({
  auth: hoisted.auth
}));

describe('RecommendationService', () => {
  beforeEach(() => {
    hoisted.callFirebaseFunction.mockReset();
    hoisted.auth.currentUser = { uid: 'user-1' };
  });

  it('returns an empty list when there is no authenticated user', async () => {
    hoisted.auth.currentUser = null as any;

    await expect(RecommendationService.listMyRecommendations()).resolves.toEqual([]);
    expect(hoisted.callFirebaseFunction).not.toHaveBeenCalled();
  });

  it('maps callable rows to typed recommendation items', async () => {
    hoisted.callFirebaseFunction.mockResolvedValue({
      items: [
        {
          collaborationId: 'collab-1',
          collaborationName: 'Night Shift',
          collaborationStatus: 'submission',
          collaborationDescription: 'late session',
          collaborationTags: ['house', 'garage'],
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
      ]
    });

    await expect(RecommendationService.listMyRecommendations()).resolves.toEqual([
      {
        collaborationId: 'collab-1',
        collaborationName: 'Night Shift',
        collaborationStatus: 'submission',
        collaborationDescription: 'late session',
        collaborationTags: ['house', 'garage'],
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

    expect(hoisted.callFirebaseFunction).toHaveBeenCalledWith('getMyRecommendations', {});
  });
});
