import { doc, getDoc } from 'firebase/firestore';
import { ref, uploadBytesResumable } from 'firebase/storage';
import { getFunctions, httpsCallable } from 'firebase/functions';
import app, { db, storage } from './firebase';
import { FileService } from './fileService';
import { DEBUG_ALLOW_MULTIPLE_SUBMISSIONS } from '../config';
import type { Collaboration, CollaborationId, UserId, SubmissionSettings, SubmissionModerationStatus } from '../types/collaboration';
import { COLLECTIONS } from '../types/collaboration';

export interface SubmissionCollabSummary {
  projectId: string;
  projectName: string;
  collabId: string;
  collabName: string;
  status: string;
  submissionCloseAt: number | null;
  votingCloseAt: number | null;
  backingPath: string;
  mySubmissionPath: string;
  winnerPath: string | null;
  submittedAt: number | null;
  submissionDurationSeconds: number | null;
  votingDurationSeconds: number | null;
  collaborationDeleted: boolean;
  collaborationDeletedAt: number | null;
  storageDeletionPending: boolean;
  storageDeletedAt: number | null;
  storageDeletionError: string | null;
  lastKnownProjectName: string;
  lastKnownCollaborationName: string;
  moderationStatus: SubmissionModerationStatus;
}

export class SubmissionService {
  static async uploadBackingTrack(
    file: File,
    collaborationId: string,
    onProgress?: (percent: number) => void
  ): Promise<string> {
    FileService.validateFileSize(file);

    const ext = FileService.getPreferredAudioExtension(file);
    const path = `collabs/${collaborationId}/backing.${ext}`;

    await FileService.uploadFile(file, path, onProgress);
    return path;
  }

  static async hasUserSubmitted(collaborationId: CollaborationId, userId: UserId): Promise<boolean> {
    if (DEBUG_ALLOW_MULTIPLE_SUBMISSIONS) return false;
    const collabRef = doc(db, COLLECTIONS.COLLABORATIONS, collaborationId);
    const snap = await getDoc(collabRef);
    const data = snap.exists() ? (snap.data() as Collaboration) : null;
    const list = (data && Array.isArray((data as any).participantIds)) ? (data as any).participantIds as string[] : [];
    return list.includes(userId);
  }

  static async uploadSubmission(
    file: File,
    collaborationId: CollaborationId,
    userId: UserId,
    onProgress?: (percent: number) => void,
    settings?: SubmissionSettings,
    multitrackZip?: File | null
  ): Promise<{ filePath: string; submissionId: string; multitrackZipPath?: string }> {
    FileService.validateFileSize(file);

    const exists = await this.hasUserSubmitted(collaborationId, userId);
    if (exists) {
      throw new Error('already submitted');
    }

    const ext = FileService.getPreferredAudioExtension(file);
    const functions = getFunctions(app, 'europe-west1');
    const reserveSlot = httpsCallable(functions, 'reserveSubmissionSlot');
    const reserveRes: any = await reserveSlot({
      collaborationId,
      fileExt: ext,
      settings: settings ?? null
    });
    const tokenData = reserveRes?.data || {};
    const submissionId = String(tokenData.submissionId || '').trim();
    const uploadTokenId = String(tokenData.tokenId || '').trim();
    if (!submissionId || !uploadTokenId) {
      throw new Error('failed to reserve submission slot');
    }

    const path = `collabs/${collaborationId}/submissions/${submissionId}.${ext}`;
    const r = ref(storage, path);
    const task = uploadBytesResumable(r, file, {
      contentType: file.type,
      customMetadata: {
        ownerUid: userId,
        uploadTokenId
      }
    });

    await new Promise<void>((resolve, reject) => {
      task.on(
        'state_changed',
        (snap) => {
          const pct = (snap.bytesTransferred / snap.totalBytes) * 100;
          if (onProgress) onProgress(Math.round(pct));
        },
        (err) => reject(err),
        () => resolve()
      );
    });

    let multitrackZipPath: string | undefined;
    if (multitrackZip) {
      multitrackZipPath = await FileService.uploadSubmissionMultitracks(
        multitrackZip,
        collaborationId,
        submissionId,
        undefined,
        userId,
        uploadTokenId
      );
    }

    return { filePath: path, submissionId, multitrackZipPath };
  }

  static async listMySubmissionCollabs(): Promise<SubmissionCollabSummary[]> {
    const functions = getFunctions(app, 'europe-west1');
    const getMine = httpsCallable(functions, 'getMySubmissionCollabs');
    const res: any = await getMine({});
    const data = (res?.data as any) || {};
    if (data?.unauthenticated) return [];
    const items: any[] = Array.isArray(data.items) ? data.items : [];
    return items.map(item => ({
      projectId: typeof item?.projectId === 'string' ? item.projectId : '',
      projectName: typeof item?.projectName === 'string' ? item.projectName : '',
      collabId: typeof item?.collabId === 'string' ? item.collabId : '',
      collabName: typeof item?.collabName === 'string' ? item.collabName : '',
      status: typeof item?.status === 'string' ? item.status : '',
      submissionCloseAt: typeof item?.submissionCloseAt === 'number' ? item.submissionCloseAt : null,
      votingCloseAt: typeof item?.votingCloseAt === 'number' ? item.votingCloseAt : null,
      backingPath: typeof item?.backingPath === 'string' ? item.backingPath : '',
      mySubmissionPath: typeof item?.mySubmissionPath === 'string' ? item.mySubmissionPath : '',
      winnerPath: typeof item?.winnerPath === 'string' ? item.winnerPath : null,
      submittedAt: typeof item?.submittedAt === 'number' ? item.submittedAt : null,
      submissionDurationSeconds: typeof item?.submissionDurationSeconds === 'number' ? item.submissionDurationSeconds : null,
      votingDurationSeconds: typeof item?.votingDurationSeconds === 'number' ? item.votingDurationSeconds : null,
      collaborationDeleted: item?.collaborationDeleted === true,
      collaborationDeletedAt: typeof item?.collaborationDeletedAt === 'number' ? item.collaborationDeletedAt : null,
      storageDeletionPending: item?.storageDeletionPending === true,
      storageDeletedAt: typeof item?.storageDeletedAt === 'number' ? item.storageDeletedAt : null,
      storageDeletionError: typeof item?.storageDeletionError === 'string' ? item.storageDeletionError : null,
      lastKnownProjectName: typeof item?.lastKnownProjectName === 'string' ? item.lastKnownProjectName : '',
      lastKnownCollaborationName: typeof item?.lastKnownCollaborationName === 'string' ? item.lastKnownCollaborationName : '',
      moderationStatus: ['pending', 'approved', 'rejected'].includes(item?.moderationStatus) ? item.moderationStatus : 'pending'
    }));
  }

  static async setSubmissionModeration(
    collaborationId: CollaborationId,
    submissionIdentifier: string,
    status: SubmissionModerationStatus,
    moderatorId: UserId
  ): Promise<SubmissionModerationStatus> {
    const functions = getFunctions(app, 'europe-west1');
    const callable = httpsCallable(functions, 'setSubmissionModeration');
    const res: any = await callable({
      collaborationId,
      submissionIdentifier,
      status,
      moderatorId
    });
    const data = res?.data || {};
    const result = data?.status;
    if (!['pending', 'approved', 'rejected'].includes(result)) {
      throw new Error('moderation-failed');
    }
    return result as SubmissionModerationStatus;
  }
}
