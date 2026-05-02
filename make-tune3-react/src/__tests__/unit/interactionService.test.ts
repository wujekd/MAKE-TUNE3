import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InteractionService } from '../../services/interactionService';

const { callFirebaseFunction } = vi.hoisted(() => ({
  callFirebaseFunction: vi.fn()
}));

vi.mock('../../services/firebaseFunctions', () => ({
  callFirebaseFunction
}));

vi.mock('../../services/userService', () => ({
  UserService: {
    getUserCollaboration: vi.fn(),
    createUserCollaboration: vi.fn(),
    updateUserCollaboration: vi.fn()
  }
}));

describe('InteractionService callable wiring', () => {
  beforeEach(() => {
    callFirebaseFunction.mockReset();
    callFirebaseFunction.mockResolvedValue({});
  });

  it('calls the submission-like callable', async () => {
    await InteractionService.likeTrack('user-1', 'collab-1', 'track-1.mp3');

    expect(callFirebaseFunction).toHaveBeenCalledWith('likeTrack', {
      collaborationId: 'collab-1',
      filePath: 'track-1.mp3'
    });
  });

  it('calls the collaboration-like callable', async () => {
    await InteractionService.likeCollaboration('user-1', 'collab-1');

    expect(callFirebaseFunction).toHaveBeenCalledWith('likeCollaboration', {
      collaborationId: 'collab-1'
    });
  });

  it('calls the collaboration-favorite callable', async () => {
    await InteractionService.favoriteCollaboration('user-1', 'collab-1');

    expect(callFirebaseFunction).toHaveBeenCalledWith('favoriteCollaboration', {
      collaborationId: 'collab-1'
    });
  });
});
