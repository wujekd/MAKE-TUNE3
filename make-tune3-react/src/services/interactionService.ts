import { doc, updateDoc, Timestamp, increment } from 'firebase/firestore';
import { db } from './firebase';
import { UserService } from './userService';
import type { UserId, CollaborationId } from '../types/collaboration';
import { COLLECTIONS } from '../types/collaboration';

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
      
      // Increment collaboration favorites counter
      const collabRef = doc(db, COLLECTIONS.COLLABORATIONS, collaborationId);
      await updateDoc(collabRef, {
        favoritesCount: increment(1),
        updatedAt: Timestamp.now()
      });
    } else {
      const favoriteTracks = [...(userCollab.favoriteTracks || [])];
      if (!favoriteTracks.includes(filePath)) {
        favoriteTracks.push(filePath);
        await UserService.updateUserCollaboration(userId, collaborationId, { favoriteTracks });
        
        // Increment collaboration favorites counter
        const collabRef = doc(db, COLLECTIONS.COLLABORATIONS, collaborationId);
        await updateDoc(collabRef, {
          favoritesCount: increment(1),
          updatedAt: Timestamp.now()
        });
      }
    }
  }

  static async removeTrackFromFavorites(userId: UserId, collaborationId: CollaborationId, filePath: string): Promise<void> {
    const userCollab = await UserService.getUserCollaboration(userId, collaborationId);
    if (userCollab) {
      const favoriteTracks = (userCollab.favoriteTracks || []).filter(track => track !== filePath);
      await UserService.updateUserCollaboration(userId, collaborationId, { favoriteTracks });
      
      // Decrement collaboration favorites counter
      const collabRef = doc(db, COLLECTIONS.COLLABORATIONS, collaborationId);
      await updateDoc(collabRef, {
        favoritesCount: increment(-1),
        updatedAt: Timestamp.now()
      });
    }
  }

  static async voteForTrack(userId: UserId, collaborationId: CollaborationId, filePath: string): Promise<void> {
    const userCollab = await UserService.getUserCollaboration(userId, collaborationId);
    const isFirstVote = !userCollab || !userCollab.finalVote;
    
    if (!userCollab) {
      await UserService.createUserCollaboration({ userId, collaborationId, finalVote: filePath });
    } else {
      await UserService.updateUserCollaboration(userId, collaborationId, { finalVote: filePath });
    }
    
    // Increment counter only if this is the user's first vote
    if (isFirstVote) {
      const collabRef = doc(db, COLLECTIONS.COLLABORATIONS, collaborationId);
      await updateDoc(collabRef, {
        votesCount: increment(1),
        updatedAt: Timestamp.now()
      });
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