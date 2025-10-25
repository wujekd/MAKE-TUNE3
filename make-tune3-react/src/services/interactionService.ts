import { UserService } from './userService';
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
    const userCollab = await UserService.getUserCollaboration(userId, collaborationId);
    if (!userCollab) {
      await UserService.createUserCollaboration({ userId, collaborationId, favoriteTracks: [filePath] });
    } else {
      const favoriteTracks = [...(userCollab.favoriteTracks || [])];
      if (!favoriteTracks.includes(filePath)) {
        favoriteTracks.push(filePath);
        await UserService.updateUserCollaboration(userId, collaborationId, { favoriteTracks });
      }
    }
  }

  static async removeTrackFromFavorites(userId: UserId, collaborationId: CollaborationId, filePath: string): Promise<void> {
    const userCollab = await UserService.getUserCollaboration(userId, collaborationId);
    if (userCollab) {
      const favoriteTracks = (userCollab.favoriteTracks || []).filter(track => track !== filePath);
      await UserService.updateUserCollaboration(userId, collaborationId, { favoriteTracks });
    }
  }

  static async voteForTrack(userId: UserId, collaborationId: CollaborationId, filePath: string): Promise<void> {
    const userCollab = await UserService.getUserCollaboration(userId, collaborationId);
    if (!userCollab) {
      await UserService.createUserCollaboration({ userId, collaborationId, votedForTrack: filePath });
    } else {
      await UserService.updateUserCollaboration(userId, collaborationId, { votedForTrack: filePath });
    }
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

