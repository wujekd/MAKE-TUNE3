import type { Timestamp } from 'firebase/firestore';

export interface User {
  uid: string;
  email: string;
  createdAt: Timestamp;
  collaborationIds: string[]; // List of collaboration IDs user has interacted with
  username?: string;
  isAdmin?: boolean;
}

export interface AuthError {
  code: string;
  message: string;
}

export type AuthMode = 'login' | 'register' | 'forgotPassword'; 