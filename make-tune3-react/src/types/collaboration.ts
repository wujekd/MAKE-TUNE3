import type { Timestamp } from 'firebase/firestore';
import type { WaveformPreview, WaveformStatus } from './waveform';

// core data models
export interface Track {
  id: string;
  title: string;
  filePath: string;
  optimizedPath?: string;
  waveformPath?: string;
  waveformStatus?: WaveformStatus;
  waveformBucketCount?: number;
  waveformVersion?: number;
  waveformError?: string | null;
  waveformPreview?: WaveformPreview;
  backingTrackPath?: string;
  submissionId?: string;
  multitrackZipPath?: string;
  duration: number;
  createdAt: Timestamp;
  collaborationId: string;
  category: 'backing' | 'submission' | 'pastStage';
  approved?: boolean;
  moderationStatus?: SubmissionModerationStatus;
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
  groupIds?: string[];
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
  creatorId?: string;
  name: string;
  description: string;
  tags: string[];
  tagsKey: string[];
  groupIds?: string[];
  visibility?: CollaborationVisibility;
  submitAccess?: ParticipationAccess;
  voteAccess?: ParticipationAccess;
  backingTrackPath: string;
  pdfPath?: string;
  resourcesZipPath?: string;
  backingWaveformPath?: string;
  backingWaveformStatus?: WaveformStatus;
  backingWaveformBucketCount?: number;
  backingWaveformVersion?: number;
  backingWaveformError?: string | null;
  backingWaveformPreview?: WaveformPreview;
  submissions?: SubmissionEntry[];
  participantIds?: string[];
  // Real-time engagement counters
  submissionsCount?: number;      // Total submissions uploaded
  reservedSubmissionsCount?: number; // Active reserved submission slots
  favoritesCount?: number;        // Total favorites across all users
  votesCount?: number;            // Total votes cast
  effectiveSubmissionLimit?: number; // Server-computed effective limit
  submissionsUsedCount?: number; // Server-computed submissionsCount + reservedSubmissionsCount
  submissionLimitOverride?: number; // Server-only override (optional)
  // pastStageTrackPaths removed - now in Project.pastCollaborations
  submissionDuration: number; // duration in seconds
  votingDuration: number; // duration in seconds
  submissionCloseAt?: Timestamp; // absolute time when submission stage ends
  votingCloseAt?: Timestamp; // absolute time when voting stage ends
  status: 'unpublished' | 'submission' | 'voting' | 'completed';
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
  waveformPath?: string;
  waveformStatus?: WaveformStatus;
  waveformBucketCount?: number;
  waveformVersion?: number;
  waveformError?: string | null;
  waveformPreview?: WaveformPreview;
  multitrackZipPath?: string;
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
  likedTracks?: string[]; // file paths
  favoriteTracks: string[]; // file paths
  likedCollaboration?: boolean;
  favoritedCollaboration?: boolean;
  finalVote: string | null; // file path
  listenedRatio: number;
  hasSubmitted?: boolean;
  lastInteraction: Timestamp;
  createdAt: Timestamp;
}

export type InteractionEntityType = 'submission' | 'collaboration';

export type InteractionEventType =
  | 'submission_like'
  | 'submission_unlike'
  | 'submission_favorite'
  | 'submission_unfavorite'
  | 'submission_vote'
  | 'collaboration_like'
  | 'collaboration_unlike'
  | 'collaboration_favorite'
  | 'collaboration_unfavorite';

export interface InteractionEvent {
  userId: string;
  projectId: string | null;
  collaborationId: string;
  trackPath: string | null;
  entityType: InteractionEntityType;
  eventType: InteractionEventType;
  createdAt: Timestamp;
  metadata?: {
    previousTrackPath?: string | null;
  };
}

export interface UserProfile {
  uid: string;
  email: string;
  createdAt: Timestamp;
  collaborationIds: string[]; // collaboration ids user interacted with
  username?: string;
  description?: string;
  socialLinks?: {
    link1?: string;
    link2?: string;
    link3?: string;
  };
  visibility?: {
    publicProfile?: boolean;
    showSocialLinks?: boolean;
    showCollaborationHistory?: boolean;
    allowCreatorContact?: boolean;
  };
}

export type GroupVisibility = 'public' | 'unlisted' | 'private';
export type GroupJoinPolicy = 'open' | 'invite_link' | 'approval_required';
export type GroupMemberRole = 'owner' | 'admin' | 'member';
export type GroupMemberStatus = 'active' | 'requested';
export type CollaborationVisibility = 'listed' | 'unlisted';
export type ParticipationAccess = 'logged_in' | 'group_members';

export interface GroupExternalLink {
  type: string;
  label?: string;
  url: string;
}

export interface Group {
  id: string;
  name: string;
  description?: string;
  visibility: GroupVisibility;
  joinPolicy: GroupJoinPolicy;
  externalLinks: GroupExternalLink[];
  ownerId: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface GroupMember {
  userId: string;
  role: GroupMemberRole;
  status: GroupMemberStatus;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface GroupInvite {
  id: string;
  groupId: string;
  createdBy: string;
  revoked: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
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

export interface SystemSettings {
  projectCreationEnabled: boolean;
  submissionsEnabled: boolean;
  votingEnabled: boolean;
  defaultProjectAllowance: number;
  maxSubmissionsPerCollab: number;
  updatedAt: Timestamp;
  updatedBy: string;
}

export type AdminLogAction = 'update-user' | 'suspend-user' | 'unsuspend-user' | 'update-settings';

export interface AdminLog {
  id: string;
  adminUid: string;
  adminEmail: string;
  action: AdminLogAction;
  targetUserId?: string;
  changes: Record<string, { from: any; to: any }>;
  createdAt: Timestamp;
}

export const COLLECTIONS = {
  PROJECTS: 'projects',
  COLLABORATIONS: 'collaborations',
  COLLABORATION_DETAILS: 'collaborationDetails',
  USER_COLLABORATIONS: 'userCollaborations',
  INTERACTION_EVENTS: 'interactionEvents',
  USERS: 'users',
  SUBMISSION_USERS: 'submissionUsers',
  USER_DOWNLOADS: 'userDownloads',
  GROUPS: 'groups',
  GROUP_INVITES: 'groupInvites',
  PROJECT_NAME_INDEX: 'projectNameIndex',
  TAGS: 'tags',
  REPORTS: 'reports',
  RESOLVED_REPORTS: 'resolvedReports',
  ADMIN_LOGS: 'adminLogs',
  SYSTEM_SETTINGS: 'systemSettings'
} as const;

export const SYSTEM_SETTINGS_DOC = 'global';

// helper types
export type TrackId = string;
export type ProjectId = string;
export type CollaborationId = string;
export type UserId = string;
export type ResourceDocType = 'backing' | 'pdf' | 'zip'; 
