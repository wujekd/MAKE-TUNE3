import type { Timestamp } from 'firebase/firestore';

export interface User {
  uid: string;
  email: string;
  createdAt: Timestamp;
}

export interface AuthError {
  code: string;
  message: string;
}

export type AuthMode = 'login' | 'register' | 'forgotPassword'; 