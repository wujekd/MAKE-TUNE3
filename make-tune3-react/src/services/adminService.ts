import { callFirebaseFunction } from './firebaseFunctions';
import type { User } from '../types/auth';
import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  type DocumentData,
  type QueryDocumentSnapshot
} from 'firebase/firestore';
import { db } from './firebaseDb';
import { COLLECTIONS, type InteractionEvent } from '../types/collaboration';

export interface UserSearchResult extends User {
  uid: string;
}

export interface UserUpdateData {
  bonusProjects?: number;
  suspended?: boolean;
}

export interface InteractionEventsPage {
  events: (InteractionEvent & { id: string })[];
  nextCursor: QueryDocumentSnapshot<DocumentData> | null;
  hasMore: boolean;
}

export interface ListInteractionEventsOptions {
  pageSize?: number;
  cursor?: QueryDocumentSnapshot<DocumentData> | null;
}

export type HsdTestEntityType =
  | 'project_name'
  | 'project_description'
  | 'collaboration_name'
  | 'collaboration_description';

export interface AdminHsdTestRequest {
  text: string;
  entityType: HsdTestEntityType;
  entityId?: string;
}

export interface AdminHsdTestResult {
  requestId: string;
  entityType: HsdTestEntityType;
  entityId: string | null;
  text: string;
  elapsedMs: number;
  modelVersion: string;
  label: string;
  score: number;
  suggestedDecision: 'allow' | 'review' | 'reject';
}

export interface PaginatedUsersResult {
  users: UserSearchResult[];
  nextPageToken: string | null;
  hasMore: boolean;
}

export interface PaginatedSearchResult {
  users: UserSearchResult[];
  nextPageToken: string | null;
  hasMore: boolean;
}

export interface AdminProjectItem {
  id: string;
  name: string;
  description: string;
  ownerId: string;
  tags: string[];
  createdAt: number | null;
  updatedAt: number | null;
}

export interface AdminCollaborationSummary {
  id: string;
  name: string;
  description: string;
  status: string;
  visibility: string;
  submitAccess: string;
  voteAccess: string;
  backingTrackPath: string;
  submissionDuration: number | null;
  votingDuration: number | null;
  publishedAt: number | null;
  submissionCloseAt: number | null;
  votingCloseAt: number | null;
  completedAt: number | null;
  submissionsCount: number;
  reservedSubmissionsCount: number;
  votesCount: number;
  favoritesCount: number;
  participantCount: number;
  tags: string[];
  createdAt: number | null;
  updatedAt: number | null;
}

export interface AdminProjectWithCollabs {
  project: AdminProjectItem;
  collaborations: AdminCollaborationSummary[];
}

export interface PaginatedProjectsResult {
  items: AdminProjectWithCollabs[];
  nextPageToken: string | null;
  hasMore: boolean;
}

export interface PaginatedReportsResult {
  reports: Array<{
    id: string;
    submissionPath: string;
    collaborationId: string;
    reportedBy: string;
    reportedByUsername: string;
    reason: string;
    status: string;
    createdAt: number | null;
    resolvedAt: number | null;
    resolvedBy: string | null;
    reportedUserId: string | null;
  }>;
  nextPageToken: string | null;
  hasMore: boolean;
}

export interface PaginatedFeedbackResult {
  feedback: Array<{
    id: string;
    uid: string;
    createdAt: number | null;
    category: string;
    message: string;
    answers: any;
    status: string;
    adminNote: string | null;
    route: string;
  }>;
  nextPageToken: string | null;
  hasMore: boolean;
}

export interface AdminGroupItem {
  id: string;
  name: string;
  description: string;
  visibility: 'public' | 'unlisted' | 'private';
  joinPolicy: 'open' | 'invite_link' | 'approval_required';
  externalLinks: Array<{ type: string; label?: string; url: string }>;
  ownerId: string;
  createdAt: number | null;
  updatedAt: number | null;
  memberCount: number;
  pendingCount: number;
  projectCount: number;
  collaborationCount: number;
}

export interface AdminGroupMemberItem {
  userId: string;
  role: 'owner' | 'admin' | 'member';
  status: 'active' | 'requested';
  createdAt: number | null;
  updatedAt: number | null;
}

export interface AdminGroupProjectItem {
  id: string;
  name: string;
  ownerId: string;
  createdAt: number | null;
  updatedAt: number | null;
}

export interface AdminGroupCollaborationItem {
  id: string;
  projectId: string;
  name: string;
  status: string;
  visibility: string;
  submitAccess: string;
  voteAccess: string;
  createdAt: number | null;
  updatedAt: number | null;
}

export interface PaginatedGroupsResult {
  groups: AdminGroupItem[];
  nextPageToken: string | null;
  hasMore: boolean;
}

export interface AdminGroupDetailsResult {
  group: AdminGroupItem;
  members: AdminGroupMemberItem[];
  projects: AdminGroupProjectItem[];
  collaborations: AdminGroupCollaborationItem[];
}

export interface AdminGroupUpdateData {
  name?: string;
  description?: string;
  visibility?: AdminGroupItem['visibility'];
  joinPolicy?: AdminGroupItem['joinPolicy'];
  externalLinks?: AdminGroupItem['externalLinks'];
}

export class AdminService {
  static async listUsers(pageSize?: number, pageToken?: string | null): Promise<PaginatedUsersResult> {
    const result = await callFirebaseFunction<
      { pageSize?: number; pageToken?: string | null },
      PaginatedUsersResult
    >('adminListUsers', { pageSize, pageToken });
    return result;
  }

  static async searchUsers(
    searchQuery: string,
    pageSize?: number,
    pageToken?: string | null
  ): Promise<PaginatedSearchResult> {
    const trimmed = searchQuery.trim();
    if (!trimmed) return { users: [], nextPageToken: null, hasMore: false };

    const result = await callFirebaseFunction<
      { searchQuery: string; pageSize?: number; pageToken?: string | null },
      PaginatedSearchResult
    >('adminSearchUsers', { searchQuery: trimmed, pageSize, pageToken });
    return result;
  }

  static async updateUserPermissions(
    userId: string,
    updates: UserUpdateData
  ): Promise<void> {
    await callFirebaseFunction('adminUpdateUser', { targetUserId: userId, updates });
  }

  static async suspendUser(userId: string): Promise<void> {
    await this.updateUserPermissions(userId, { suspended: true });
  }

  static async unsuspendUser(userId: string): Promise<void> {
    await this.updateUserPermissions(userId, { suspended: false });
  }

  static async listProjects(pageSize?: number, pageToken?: string | null): Promise<PaginatedProjectsResult> {
    const result = await callFirebaseFunction<
      { pageSize?: number; pageToken?: string | null },
      PaginatedProjectsResult
    >('adminListProjects', { pageSize, pageToken });
    return result;
  }

  static async updateCollaborationStageDates(
    collaborationId: string,
    updates: { submissionCloseAt?: number | null; votingCloseAt?: number | null }
  ): Promise<void> {
    await callFirebaseFunction('adminUpdateCollaborationStageDates', { collaborationId, updates });
  }

  static async listGroups(
    pageSize?: number,
    pageToken?: string | null,
    visibility?: string | null
  ): Promise<PaginatedGroupsResult> {
    return callFirebaseFunction<
      { pageSize?: number; pageToken?: string | null; visibility?: string | null },
      PaginatedGroupsResult
    >('adminListGroups', { pageSize, pageToken, visibility });
  }

  static async getGroup(groupId: string): Promise<AdminGroupDetailsResult> {
    return callFirebaseFunction<{ groupId: string }, AdminGroupDetailsResult>('adminGetGroup', { groupId });
  }

  static async updateGroup(groupId: string, updates: AdminGroupUpdateData): Promise<void> {
    await callFirebaseFunction('adminUpdateGroup', { groupId, updates });
  }

  static async updateGroupMember(
    groupId: string,
    userId: string,
    updates: { role?: AdminGroupMemberItem['role']; status?: AdminGroupMemberItem['status']; remove?: boolean }
  ): Promise<void> {
    await callFirebaseFunction('adminUpdateGroupMember', { groupId, userId, ...updates });
  }

  static async removeGroupAttachment(
    groupId: string,
    kind: 'project' | 'collaboration',
    targetId: string
  ): Promise<void> {
    await callFirebaseFunction('adminRemoveGroupAttachment', { groupId, kind, targetId });
  }

  static async deleteGroup(groupId: string): Promise<void> {
    await callFirebaseFunction('adminDeleteGroup', { groupId });
  }

  static async listPendingReports(pageSize?: number, pageToken?: string | null): Promise<PaginatedReportsResult> {
    const result = await callFirebaseFunction<
      { pageSize?: number; pageToken?: string | null },
      PaginatedReportsResult
    >('adminListPendingReports', { pageSize, pageToken });
    return result;
  }

  static async listResolvedReports(pageSize?: number, pageToken?: string | null): Promise<PaginatedReportsResult> {
    const result = await callFirebaseFunction<
      { pageSize?: number; pageToken?: string | null },
      PaginatedReportsResult
    >('adminListResolvedReports', { pageSize, pageToken });
    return result;
  }

  static async listFeedback(
    pageSize?: number,
    pageToken?: string | null,
    category?: string | null,
    status?: string | null
  ): Promise<PaginatedFeedbackResult> {
    const result = await callFirebaseFunction<
      { pageSize?: number; pageToken?: string | null; category?: string | null; status?: string | null },
      PaginatedFeedbackResult
    >('adminListFeedback', { pageSize, pageToken, category, status });
    return result;
  }

  static async listInteractionEvents(
    options: ListInteractionEventsOptions = {}
  ): Promise<InteractionEventsPage> {
    const pageSize = Math.max(1, Math.min(100, options.pageSize ?? 25));
    const constraints = [orderBy('createdAt', 'desc'), limit(pageSize + 1)] as const;

    const baseQuery = options.cursor
      ? query(collection(db, COLLECTIONS.INTERACTION_EVENTS), ...constraints, startAfter(options.cursor))
      : query(collection(db, COLLECTIONS.INTERACTION_EVENTS), ...constraints);

    const snapshot = await getDocs(baseQuery);
    const docs = snapshot.docs;
    const visibleDocs = docs.slice(0, pageSize);

    return {
      events: visibleDocs.map(docSnap => ({
        id: docSnap.id,
        ...(docSnap.data() as InteractionEvent)
      })),
      nextCursor: visibleDocs.length > 0 ? visibleDocs[visibleDocs.length - 1] : null,
      hasMore: docs.length > pageSize
    };
  }

  static async runHsdTest(input: AdminHsdTestRequest): Promise<AdminHsdTestResult> {
    return callFirebaseFunction<AdminHsdTestRequest, AdminHsdTestResult>('adminRunHsdTest', input);
  }
}
