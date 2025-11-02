import type { Timestamp } from 'firebase/firestore';

// core data models
export interface Track {
  id: string;
  title: string;
  filePath: string;
  optimizedPath?: string;
  backingTrackPath?: string;
  submissionId?: string;
  duration: number;
  createdAt: Timestamp;
  collaborationId: string;
  category: 'backing' | 'submission' | 'pastStage';
  approved?: boolean; // submissions moderation
  moderationStatus?: SubmissionModerationStatus;
  // optional submission settings attached for voting playback
  submissionSettings?: SubmissionSettings;
}

export interface PastCollaboration {
  collaborationId: string;
  name: string;
  winnerTrackPath: string;     // winning submission path
  backingTrackPath?: string;   // backing track used during collaboration
  winnerUserId?: string | null;
  winnerUserName?: string;
  winnerVotes?: number;
  totalVotes?: number;
  participationCount?: number;  // participant count
  publishedAt?: Timestamp | null;
  submissionCloseAt?: Timestamp | null;
  votingCloseAt?: Timestamp | null;
  completedAt?: Timestamp | null;
  pastStageTrackPath: string;  // past stage track (fallback for playback)
}

export interface Project {
  id: string;
  name: string;
  description: string;
  tags: string[];
  tagsKey: string[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
  ownerId: string;
  isActive: boolean;
  pastCollaborations: PastCollaboration[]; // new field
  currentCollaborationId?: string | null;
  currentCollaborationStatus?: Collaboration['status'] | null;
  currentCollaborationStageEndsAt?: Timestamp | null;
}

export interface Collaboration {
  id: string;
  projectId: string;
  name: string;
  description: string;
  tags: string[];
  tagsKey: string[];
  backingTrackPath: string; // direct file path
  // New model: submission entries with path and settings
  submissions?: SubmissionEntry[];
  participantIds?: string[]; // user ids who submitted
  // pastStageTrackPaths removed - now in Project.pastCollaborations
  submissionDuration: number; // duration in seconds
  votingDuration: number; // duration in seconds
  submissionCloseAt?: Timestamp; // absolute time when submission stage ends
  votingCloseAt?: Timestamp; // absolute time when voting stage ends
  status: 'unpublished' | 'submission' | 'voting' | 'completed';
  requiresModeration?: boolean; // when true, new submissions need approval
  unmoderatedSubmissions?: boolean; // has pending unmoderated submissions
  // results (set by CF on completion)
  winnerPath?: string;
  winnerUserId?: string | null;
  winnerUserName?: string;
  winnerVotes?: number;
  totalVotes?: number;
  participationCount?: number;
  results?: { path: string; votes: number }[];
  resultsComputedAt?: Timestamp;
  completedAt?: Timestamp;
  createdAt: Timestamp;
  publishedAt: Timestamp | null; // when collaboration becomes active
  updatedAt: Timestamp;
}

// Submission settings saved with each submission
export interface SubmissionSettings {
  eq: {
    highshelf: { gain: number; frequency: number };
    param2: { gain: number; frequency: number; Q: number };
    param1: { gain: number; frequency: number; Q: number };
    highpass: { frequency: number; enabled?: boolean };
  };
  volume: { gain: number }; // linear 0-1
}

export interface SubmissionEntry {
  path: string;
  optimizedPath?: string;
  settings: SubmissionSettings;
  submissionId?: string;
  createdAt?: Timestamp;
  moderationStatus?: SubmissionModerationStatus;
  moderatedAt?: Timestamp;
  moderatedBy?: string;
}

export interface CollaborationDetail {
  id: string;
  collaborationId: string;
  submissions: SubmissionEntry[];
  submissionPaths?: string[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type SubmissionModerationStatus = 'pending' | 'approved' | 'rejected';

// private collection - admin only
export interface SubmissionUser {
  id: string;
  filePath: string; // references file path
  userId: string; // who submitted it
  collaborationId: string;
  artist: string; // real artist name
  createdAt: Timestamp;
  isBanned?: boolean;
}

export type ReportStatus = 'pending' | 'dismissed' | 'user-banned';

export interface Report {
  id: string;
  submissionPath: string;
  collaborationId: string;
  reportedUserId?: string;
  reportedBy: string;
  reportedByUsername?: string;
  reason: string;
  status: ReportStatus;
  createdAt: Timestamp;
  resolvedAt?: Timestamp;
  resolvedBy?: string;
}

export interface UserCollaboration {
  userId: string;
  collaborationId: string;
  listenedTracks: string[]; // file paths
  favoriteTracks: string[]; // file paths
  finalVote: string | null; // file path
  listenedRatio: number;
  hasSubmitted?: boolean;
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

export interface Tag {
  name: string;
  key: string;
  projectCount: number;
  collaborationCount: number;
  lastUpdatedAt: Timestamp;
  createdAt: Timestamp;
}

// firebase collection names
export const COLLECTIONS = {
  PROJECTS: 'projects',
  COLLABORATIONS: 'collaborations',
  COLLABORATION_DETAILS: 'collaborationDetails',
  USER_COLLABORATIONS: 'userCollaborations',
  USERS: 'users',
  SUBMISSION_USERS: 'submissionUsers', // private collection
  USER_DOWNLOADS: 'userDownloads',
  PROJECT_NAME_INDEX: 'projectNameIndex',
  TAGS: 'tags',
  REPORTS: 'reports',
  RESOLVED_REPORTS: 'resolvedReports'
} as const;

// helper types
export type TrackId = string;
export type ProjectId = string;
export type CollaborationId = string;
export type UserId = string; 
