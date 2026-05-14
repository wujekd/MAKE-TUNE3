import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from './firebaseDb';
import { callFirebaseFunction } from './firebaseFunctions';
import { COLLECTIONS } from '../types/collaboration';
import type {
  Collaboration,
  Group,
  GroupExternalLink,
  GroupJoinPolicy,
  GroupMember,
  GroupVisibility,
  Project
} from '../types/collaboration';

export interface CreateGroupInput {
  name: string;
  description?: string;
  visibility: GroupVisibility;
  joinPolicy: GroupJoinPolicy;
  externalLinks?: GroupExternalLink[];
}

export interface GroupDetails {
  group: Group | null;
  membership: GroupMember | null;
  canManage: boolean;
}

export class GroupService {
  static async createGroup(input: CreateGroupInput): Promise<Group> {
    return callFirebaseFunction<CreateGroupInput, Group>('createGroup', input);
  }

  static async listPublicGroups(): Promise<Group[]> {
    const snap = await getDocs(query(
      collection(db, COLLECTIONS.GROUPS),
      where('visibility', '==', 'public')
    ));
    return snap.docs.map(doc => ({ ...(doc.data() as any), id: doc.id } as Group));
  }

  static async listMyGroups(): Promise<Group[]> {
    const data = await callFirebaseFunction<Record<string, never>, { groups?: Group[] }>('listMyGroups', {});
    return Array.isArray(data?.groups) ? data.groups : [];
  }

  static async getGroup(groupId: string): Promise<GroupDetails> {
    return callFirebaseFunction<{ groupId: string }, GroupDetails>('getGroup', { groupId });
  }

  static async joinOpenGroup(groupId: string): Promise<void> {
    await callFirebaseFunction('joinOpenGroup', { groupId });
  }

  static async requestGroupAccess(groupId: string): Promise<void> {
    await callFirebaseFunction('requestGroupAccess', { groupId });
  }

  static async approveGroupMember(groupId: string, userId: string): Promise<void> {
    await callFirebaseFunction('approveGroupMember', { groupId, userId });
  }

  static async listGroupMembers(groupId: string): Promise<GroupMember[]> {
    const data = await callFirebaseFunction<{ groupId: string }, { members?: GroupMember[] }>(
      'listGroupMembers',
      { groupId }
    );
    return Array.isArray(data?.members) ? data.members : [];
  }

  static async createGroupInvite(groupId: string): Promise<{ inviteId: string }> {
    return callFirebaseFunction<{ groupId: string }, { inviteId: string }>('createGroupInvite', { groupId });
  }

  static async joinGroupWithInvite(inviteId: string): Promise<{ groupId: string }> {
    return callFirebaseFunction<{ inviteId: string }, { groupId: string }>('joinGroupWithInvite', { inviteId });
  }

  static async listGroupCollaborations(groupId: string): Promise<Collaboration[]> {
    const data = await callFirebaseFunction<{ groupId: string }, { collaborations?: Collaboration[] }>(
      'listGroupCollaborations',
      { groupId }
    );
    return Array.isArray(data?.collaborations) ? data.collaborations : [];
  }

  static async listGroupProjects(groupId: string): Promise<Project[]> {
    const data = await callFirebaseFunction<{ groupId: string }, { projects?: Project[] }>(
      'listGroupProjects',
      { groupId }
    );
    return Array.isArray(data?.projects) ? data.projects : [];
  }

  static async removeCollaborationFromGroup(groupId: string, collaborationId: string): Promise<void> {
    await callFirebaseFunction('removeCollaborationFromGroup', { groupId, collaborationId });
  }

  static async attachCollaborationToGroup(groupId: string, collaborationId: string): Promise<void> {
    await callFirebaseFunction('attachCollaborationToGroup', { groupId, collaborationId });
  }

  static async removeProjectFromGroup(groupId: string, projectId: string): Promise<void> {
    await callFirebaseFunction('removeProjectFromGroup', { groupId, projectId });
  }

  static async attachProjectToGroup(groupId: string, projectId: string): Promise<void> {
    await callFirebaseFunction('attachProjectToGroup', { groupId, projectId });
  }
}
