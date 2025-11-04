import { CollaborationService } from './collaborationService';
import { UserService } from './userService';
import type { Collaboration, UserCollaboration, UserProfile, UserId, CollaborationId } from '../types/collaboration';

export class DataService {
  static async loadCollaborationData(userId: UserId, collaborationId: CollaborationId): Promise<{
    collaboration: Collaboration | null;
    userCollaboration: UserCollaboration | null;
    userProfile: UserProfile | null;
  }> {
    const [collaboration, userCollaboration, userProfile] = await Promise.all([
      CollaborationService.getCollaborationWithDetails(collaborationId),
      UserService.getUserCollaboration(userId, collaborationId),
      UserService.getUserProfile(userId),
    ]);
    return { collaboration, userCollaboration, userProfile };
  }

  static async loadCollaborationDataAnonymous(collaborationId: CollaborationId): Promise<{
    collaboration: Collaboration | null;
  }> {
    const collaboration = await CollaborationService.getCollaborationWithDetails(collaborationId);
    return { collaboration };
  }

  static async loadCollaborationStatus(collaborationId: CollaborationId): Promise<{
    collaboration: Collaboration | null;
  }> {
    const collaboration = await CollaborationService.getCollaboration(collaborationId);
    return { collaboration };
  }
}
