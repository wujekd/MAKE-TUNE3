import type { User } from '../types/auth';

const TIER_LIMITS: Record<string, number> = {
  free: 0,
  beta: 3,
  premium: 100
};

export function canCreateProject(user: User | null): boolean {
  if (!user) return false;
  if (user.isAdmin === true) return true;
  const tier = user.tier || 'free';
  const baseLimit = TIER_LIMITS[tier] ?? 0;
  const bonus = user.bonusProjects ?? 0;
  const totalLimit = baseLimit + bonus;
  const count = user.projectCount ?? 0;
  return count < totalLimit;
}

export function getProjectAllowance(user: User | null): { current: number; limit: number } | null {
  if (!user) return null;
  if (user.isAdmin) return { current: user.projectCount ?? 0, limit: Infinity };
  const tier = user.tier || 'free';
  const baseLimit = TIER_LIMITS[tier] ?? 0;
  const bonus = user.bonusProjects ?? 0;
  return { current: user.projectCount ?? 0, limit: baseLimit + bonus };
}

