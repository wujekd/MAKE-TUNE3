import type { Timestamp } from 'firebase/firestore';

// core data models
export interface Track {
  id: string;
  title: string;
  filePath: string;
  duration: number;
  createdAt: Timestamp;
  collaborationId: string;
  category: 'backing' | 'submission' | 'pastStage';
  approved?: boolean; // submissions moderation
}

export interface PastCollaboration {
  collaborationId: string;
  name: string;
  winnerTrackPath: string;     // winning submission path
  totalVotes: number;
  participationCount: number;  // participant count
  completedAt: Timestamp;
  pastStageTrackPath: string;  // past stage track
}

export interface Project {
  id: string;
  name: string;
  description: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  ownerId: string;
  isActive: boolean;
  pastCollaborations: PastCollaboration[]; // new field
}

export interface Collaboration {
  id: string;
  projectId: string;
  name: string;
  description: string;
  backingTrackPath: string; // direct file path
  submissionPaths: string[]; // submission file paths
  // pastStageTrackPaths removed - now in Project.pastCollaborations
  submissionDuration: number; // duration in seconds
  votingDuration: number; // duration in seconds
  status: 'unpublished' | 'submission' | 'voting' | 'completed';
  createdAt: Timestamp;
  publishedAt: Timestamp | null; // when collaboration becomes active
  updatedAt: Timestamp;
}

// private collection - admin only
export interface SubmissionUser {
  id: string;
  filePath: string; // references file path
  userId: string; // who submitted it
  collaborationId: string;
  artist: string; // real artist name
  createdAt: Timestamp;
}

export interface UserCollaboration {
  userId: string;
  collaborationId: string;
  listenedTracks: string[]; // file paths
  favoriteTracks: string[]; // file paths
  finalVote: string | null; // file path
  listenedRatio: number;
  lastInteraction: Timestamp;
  createdAt: Timestamp;
}

export interface UserProfile {
  uid: string;
  email: string;
  createdAt: Timestamp;
  collaborationIds: string[]; // collaboration ids user interacted with
}

export interface CollaborationData {
  project: Project;
  userCollaboration: UserCollaboration;
  allTracks: Track[];
  regularTracks: Track[];
  pastStageTracks: Track[];
}

// firebase collection names
export const COLLECTIONS = {
  PROJECTS: 'projects',
  COLLABORATIONS: 'collaborations',
  USER_COLLABORATIONS: 'userCollaborations',
  USERS: 'users',
  SUBMISSION_USERS: 'submissionUsers' // private collection
} as const;

// helper types
export type TrackId = string;
export type ProjectId = string;
export type CollaborationId = string;
export type UserId = string; 