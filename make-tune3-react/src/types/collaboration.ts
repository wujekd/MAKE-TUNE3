import type { Timestamp } from 'firebase/firestore';

// Core data models
export interface Track {
  id: string;
  title: string;
  artist: string;
  filePath: string;
  duration: number;
  createdAt: Timestamp;
  projectId: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  ownerId: string;
  isActive: boolean;
  tracks: Track[];
  backingTrack: Track | null;
}

export interface UserCollaboration {
  userId: string;
  projectId: string;
  listenedTracks: string[]; // Track IDs
  favoriteTracks: string[]; // Track IDs
  finalVote: string | null; // Track ID
  listenedRatio: number;
  lastInteraction: Timestamp;
  createdAt: Timestamp;
}

export interface CollaborationData {
  project: Project;
  userCollaboration: UserCollaboration;
  allTracks: Track[];
  regularTracks: Track[];
  pastStageTracks: Track[];
}

// Firebase collection names
export const COLLECTIONS = {
  PROJECTS: 'projects',
  TRACKS: 'tracks',
  USER_COLLABORATIONS: 'userCollaborations',
  USERS: 'users'
} as const;

// Helper types
export type TrackId = string;
export type ProjectId = string;
export type UserId = string; 