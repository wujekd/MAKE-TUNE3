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

export class AdminService {
  static async listAllUsers(): Promise<UserSearchResult[]> {
    const result = await callFirebaseFunction<void, { users: UserSearchResult[] }>('adminListUsers');
    return result.users;
  }

  static async searchUsers(searchQuery: string): Promise<UserSearchResult[]> {
    const trimmed = searchQuery.trim();
    if (!trimmed) return [];

    const result = await callFirebaseFunction<{ searchQuery: string }, { users: UserSearchResult[] }>(
      'adminSearchUsers',
      { searchQuery: trimmed }
    );
    return result.users;
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
