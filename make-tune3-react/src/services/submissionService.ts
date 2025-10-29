import { doc, getDoc, updateDoc, addDoc, collection, Timestamp, arrayUnion, runTransaction, setDoc } from 'firebase/firestore';
import { ref, uploadBytesResumable, type UploadTaskSnapshot } from 'firebase/storage';
import { getFunctions, httpsCallable } from 'firebase/functions';
import app, { db, storage } from './firebase';
import { FileService } from './fileService';
import { DEBUG_ALLOW_MULTIPLE_SUBMISSIONS } from '../config';
import type { Collaboration, CollaborationDetail, CollaborationId, UserId, SubmissionSettings, SubmissionModerationStatus } from '../types/collaboration';
import { COLLECTIONS } from '../types/collaboration';

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
    settings?: SubmissionSettings
  ): Promise<{ filePath: string; submissionId: string }> {
    FileService.validateFileSize(file);
    
    const exists = await this.hasUserSubmitted(collaborationId, userId);
    if (exists) {
      throw new Error('already submitted');
    }
    
    const ext = FileService.getPreferredAudioExtension(file);
    const submissionId = (typeof crypto !== 'undefined' && (crypto as any).randomUUID) 
      ? (crypto as any).randomUUID() 
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const path = `collabs/${collaborationId}/submissions/${submissionId}.${ext}`;
    const r = ref(storage, path);
    const task = uploadBytesResumable(r, file, { 
      contentType: file.type, 
      customMetadata: { ownerUid: userId } 
    });
    
    const uploaded: UploadTaskSnapshot = await new Promise((resolve, reject) => {
      task.on(
        'state_changed',
        (snap) => {
          const pct = (snap.bytesTransferred / snap.totalBytes) * 100;
          if (onProgress) onProgress(Math.round(pct));
        },
        (err) => reject(err),
        () => resolve(task.snapshot)
      );
    });
    
    const createdAt = Timestamp.now();

    const collabRef = doc(db, COLLECTIONS.COLLABORATIONS, collaborationId);
    const now = Timestamp.now();
    await updateDoc(collabRef, { 
      participantIds: arrayUnion(userId), 
      updatedAt: now
    });

    await addDoc(collection(db, COLLECTIONS.SUBMISSION_USERS), {
      userId,
      collaborationId,
      submissionId,
      path,
      contentType: uploaded.metadata.contentType || file.type,
      size: uploaded.metadata.size || file.size,
      createdAt
    });

    const collabSnap = await getDoc(collabRef);
    if (collabSnap.exists()) {
      const data = collabSnap.data() as Collaboration;
      const needsMod = data.requiresModeration ? true : ((data as any).unmoderatedSubmissions === true);
      const defaultSettings = settings ?? {
        eq: {
          highshelf: { gain: 0, frequency: 8000 },
          param2: { gain: 0, frequency: 3000, Q: 1 },
          param1: { gain: 0, frequency: 250, Q: 1 },
          highpass: { frequency: 20, enabled: false }
        },
        volume: { gain: 1 }
      };

      const newModerationStatus: SubmissionModerationStatus = data.requiresModeration ? 'pending' : 'approved';

      const entry: Record<string, any> = {
        path,
        submissionId,
        settings: defaultSettings,
        createdAt,
        moderationStatus: newModerationStatus
      };

      if (!data.requiresModeration) {
        entry.moderatedAt = createdAt;
        entry.moderatedBy = userId;
      }

      const detailRef = doc(db, COLLECTIONS.COLLABORATION_DETAILS, collaborationId);
      const updateDetail = updateDoc(detailRef, {
        submissions: arrayUnion(entry),
        submissionPaths: arrayUnion(path),
        updatedAt: Timestamp.now()
      }).catch(async () => {
        await setDoc(detailRef, {
          collaborationId,
          submissions: [entry],
          submissionPaths: [path],
          createdAt,
          updatedAt: Timestamp.now()
        });
      });

      const updateCollab = updateDoc(collabRef, { 
        updatedAt: Timestamp.now(),
        unmoderatedSubmissions: data.requiresModeration ? true : ((data as any).unmoderatedSubmissions === true)
      }).catch(() => {});

      await Promise.all([updateDetail, updateCollab]);
    }

    return { filePath: path, submissionId };
  }

  static async listMySubmissionCollabs(): Promise<Array<{
    projectId: string;
    projectName: string;
    collabId: string;
    collabName: string;
    status: Collaboration['status'];
    submissionCloseAt: number | null;
    votingCloseAt: number | null;
    backingPath: string;
    mySubmissionPath: string;
    winnerPath: string | null;
    submittedAt: number | null;
  }>> {
    const functions = getFunctions(app, 'europe-west1');
    const getMine = httpsCallable(functions, 'getMySubmissionCollabs');
    const res: any = await getMine({});
    const data = (res?.data as any) || {};
    if (data?.unauthenticated) return [];
    return Array.isArray(data.items) ? data.items : [];
  }

  static async setSubmissionModeration(
    collaborationId: CollaborationId,
    submissionIdentifier: string,
    status: SubmissionModerationStatus,
    moderatorId: UserId
  ): Promise<SubmissionModerationStatus> {
    const collabRef = doc(db, COLLECTIONS.COLLABORATIONS, collaborationId);
    const detailRef = doc(db, COLLECTIONS.COLLABORATION_DETAILS, collaborationId);
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(collabRef);
      if (!snap.exists()) {
        throw new Error('collaboration-not-found');
      }

      const detailSnap = await tx.get(detailRef);
      if (!detailSnap.exists()) {
        throw new Error('collaboration-details-not-found');
      }
      const detailData = detailSnap.data() as CollaborationDetail;

      const submissionsArray = Array.isArray(detailData.submissions) ? [...detailData.submissions] : [];
      if (submissionsArray.length === 0) {
        throw new Error('no-submissions');
      }

      const targetIndex = submissionsArray.findIndex((entry: any) => {
        if (!entry) return false;
        const entryId = entry.submissionId || entry.path;
        return entryId === submissionIdentifier || entry.path === submissionIdentifier;
      });

      if (targetIndex === -1) {
        throw new Error('submission-not-found');
      }

      const target = submissionsArray[targetIndex] || {};
      const currentStatus: SubmissionModerationStatus = target.moderationStatus || 'pending';
      if (currentStatus !== 'pending') {
        throw new Error('already-moderated');
      }

      const now = Timestamp.now();
      submissionsArray[targetIndex] = {
        ...target,
        submissionId: target.submissionId || submissionIdentifier,
        moderationStatus: status,
        moderatedAt: now,
        moderatedBy: moderatorId
      };

      const stillPending = submissionsArray.some((entry: any) => entry?.moderationStatus === 'pending');

      tx.update(detailRef, {
        submissions: submissionsArray,
        updatedAt: now
      });

      tx.update(collabRef, {
        unmoderatedSubmissions: stillPending,
        updatedAt: now
      });
    });

    return status;
  }
}
