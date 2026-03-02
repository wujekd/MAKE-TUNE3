import type { Timestamp } from 'firebase/firestore';

export interface UserSocialLinks {
  link1?: string;
  link2?: string;
  link3?: string;
}

export interface UserVisibility {
  publicProfile?: boolean;
  showSocialLinks?: boolean;
  showCollaborationHistory?: boolean;
  allowCreatorContact?: boolean;
}

export interface User {
  uid: string;
  email: string;
  createdAt: Timestamp;
  collaborationIds: string[];
  username?: string;
  description?: string;
  socialLinks?: UserSocialLinks;
  visibility?: UserVisibility;
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
