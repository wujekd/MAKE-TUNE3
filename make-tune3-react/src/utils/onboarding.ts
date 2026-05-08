import type { User } from '../types/auth';

export const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;

export function hasValidUsername(user: Pick<User, 'username'> | null | undefined): boolean {
  const username = user?.username?.trim();
  return Boolean(username && USERNAME_PATTERN.test(username));
}

export function needsUsernameOnboarding(user: Pick<User, 'username'> | null | undefined): boolean {
  return Boolean(user && !hasValidUsername(user));
}
