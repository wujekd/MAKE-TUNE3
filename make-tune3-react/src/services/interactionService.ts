import { UserService } from './userService';
import { callFirebaseFunction } from './firebaseFunctions';
import type { UserId, CollaborationId } from '../types/collaboration';

export class InteractionService {
  static async markTrackAsListened(userId: UserId, collaborationId: CollaborationId, filePath: string): Promise<void> {
    await UserService.addListenedTrack(userId, collaborationId, filePath);
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
    await UserService.upsertUserCollaboration(userId, collaborationId, { listenedRatio: ratio });
  }
}
