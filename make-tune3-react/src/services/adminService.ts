import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase';
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
    const listFn = httpsCallable(functions, 'adminListUsers');
    const result = await listFn();
    return (result.data as any).users;
  }

  static async searchUsers(searchQuery: string): Promise<UserSearchResult[]> {
    const trimmed = searchQuery.trim();
    if (!trimmed) return [];

    const searchFn = httpsCallable(functions, 'adminSearchUsers');
    const result = await searchFn({ searchQuery: trimmed });
    return (result.data as any).users;
  }

  static async updateUserPermissions(
    userId: string, 
    updates: UserUpdateData
  ): Promise<void> {
    const updateFn = httpsCallable(functions, 'adminUpdateUser');
    await updateFn({ targetUserId: userId, updates });
  }

  static async suspendUser(userId: string): Promise<void> {
    await this.updateUserPermissions(userId, { suspended: true });
  }

  static async unsuspendUser(userId: string): Promise<void> {
    await this.updateUserPermissions(userId, { suspended: false });
  }
}
