import { Timestamp } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import app from './firebase';
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
    const functions = getFunctions(app, 'europe-west1');
    const callable = httpsCallable(functions, 'addFavoriteTrack');
    await callable({ collaborationId, filePath });
  }

  static async removeTrackFromFavorites(userId: UserId, collaborationId: CollaborationId, filePath: string): Promise<void> {
    const functions = getFunctions(app, 'europe-west1');
    const callable = httpsCallable(functions, 'removeFavoriteTrack');
    await callable({ collaborationId, filePath });
  }

  static async voteForTrack(userId: UserId, collaborationId: CollaborationId, filePath: string): Promise<void> {
    const functions = getFunctions(app, 'europe-west1');
    const callable = httpsCallable(functions, 'voteForTrack');
    await callable({ collaborationId, filePath });
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
