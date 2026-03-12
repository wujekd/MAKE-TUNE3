import { callFirebaseFunction } from './firebaseFunctions';
import type { User } from '../types/auth';

export interface UserSearchResult extends User {
  uid: string;
}

export interface UserUpdateData {
  bonusProjects?: number;
  suspended?: boolean;
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
}
