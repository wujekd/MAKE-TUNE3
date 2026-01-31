import type { User } from '../types/auth';

export function canCreateProject(user: User | null): boolean {
  if (!user) return false;
  return user.isAdmin === true;
}

