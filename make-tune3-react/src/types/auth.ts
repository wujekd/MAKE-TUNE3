import type { Timestamp } from 'firebase/firestore';

export interface User {
  uid: string;
  email: string;
  createdAt: Timestamp;
  collaborationIds: string[];
  username?: string;
  isAdmin?: boolean;
  tier?: 'free' | 'beta' | 'premium';
  bonusProjects?: number;
  projectCount?: number;
  suspended?: boolean;
  suspendedAt?: Timestamp;
  suspendedBy?: string;
}

export interface AuthError {
  code: string;
  message: string;
}

export type AuthMode = 'login' | 'register' | 'forgotPassword'; 