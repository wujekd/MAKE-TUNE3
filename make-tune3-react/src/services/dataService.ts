import { CollaborationService as CollaborationServiceNew } from './collaborationServiceNew';
import { UserService } from './userService';
import type { Collaboration, UserCollaboration, UserProfile, UserId, CollaborationId } from '../types/collaboration';

export class DataService {
  static async loadCollaborationData(userId: UserId, collaborationId: CollaborationId): Promise<{
    collaboration: Collaboration | null;
    userCollaboration: UserCollaboration | null;
    userProfile: UserProfile | null;
  }> {
    const [collaboration, userCollaboration, userProfile] = await Promise.all([
      CollaborationServiceNew.getCollaboration(collaborationId),
      UserService.getUserCollaboration(userId, collaborationId),
      UserService.getUserProfile(userId),
    ]);
    return { collaboration, userCollaboration, userProfile };
  }

  static async loadCollaborationDataAnonymous(collaborationId: CollaborationId): Promise<{
    collaboration: Collaboration | null;
  }> {
    const collaboration = await CollaborationServiceNew.getCollaboration(collaborationId);
    return { collaboration };
  }
}

