import { UserService } from './userService';
import { callFirebaseFunction } from './firebaseFunctions';
import type { UserId, CollaborationId } from '../types/collaboration';

export class InteractionService {
  static async markTrackAsListened(userId: UserId, collaborationId: CollaborationId, filePath: string): Promise<void> {
    const userCollab = await UserService.getUserCollaboration(userId, collaborationId);
    if (!userCollab) {
      await UserService.createUserCollaboration({ userId, collaborationId, listenedTracks: [filePath] });
    } else {
      const listenedTracks = [...(userCollab.listenedTracks || [])];
      if (!listenedTracks.includes(filePath)) {
        listenedTracks.push(filePath);
        await UserService.updateUserCollaboration(userId, collaborationId, { listenedTracks });
      }
    }
  }

  static async addTrackToFavorites(userId: UserId, collaborationId: CollaborationId, filePath: string): Promise<void> {
    await callFirebaseFunction('addFavoriteTrack', { collaborationId, filePath });
  }

  static async removeTrackFromFavorites(userId: UserId, collaborationId: CollaborationId, filePath: string): Promise<void> {
    await callFirebaseFunction('removeFavoriteTrack', { collaborationId, filePath });
  }

  static async likeTrack(userId: UserId, collaborationId: CollaborationId, filePath: string): Promise<void> {
    await callFirebaseFunction('likeTrack', { collaborationId, filePath });
  }

  static async unlikeTrack(userId: UserId, collaborationId: CollaborationId, filePath: string): Promise<void> {
    await callFirebaseFunction('unlikeTrack', { collaborationId, filePath });
  }

  static async voteForTrack(userId: UserId, collaborationId: CollaborationId, filePath: string): Promise<void> {
    await callFirebaseFunction('voteForTrack', { collaborationId, filePath });
  }

  static async likeCollaboration(userId: UserId, collaborationId: CollaborationId): Promise<void> {
    await callFirebaseFunction('likeCollaboration', { collaborationId });
  }

  static async unlikeCollaboration(userId: UserId, collaborationId: CollaborationId): Promise<void> {
    await callFirebaseFunction('unlikeCollaboration', { collaborationId });
  }

  static async favoriteCollaboration(userId: UserId, collaborationId: CollaborationId): Promise<void> {
    await callFirebaseFunction('favoriteCollaboration', { collaborationId });
  }

  static async unfavoriteCollaboration(userId: UserId, collaborationId: CollaborationId): Promise<void> {
    await callFirebaseFunction('unfavoriteCollaboration', { collaborationId });
  }

  static async setListenedRatio(userId: UserId, collaborationId: CollaborationId, ratio: number): Promise<void> {
    const userCollab = await UserService.getUserCollaboration(userId, collaborationId);
    if (!userCollab) {
      await UserService.createUserCollaboration({ userId, collaborationId, listenedRatio: ratio });
    } else {
      await UserService.updateUserCollaboration(userId, collaborationId, { listenedRatio: ratio });
    }
  }
}
