import { doc, getDoc, updateDoc, addDoc, collection, Timestamp, arrayUnion } from 'firebase/firestore';
import { ref, uploadBytesResumable, type UploadTaskSnapshot } from 'firebase/storage';
import { getFunctions, httpsCallable } from 'firebase/functions';
import app, { db, storage } from './firebase';
import { FileService } from './fileService';
import { DEBUG_ALLOW_MULTIPLE_SUBMISSIONS } from '../config';
import type { Collaboration, CollaborationId, UserId, SubmissionSettings } from '../types/collaboration';
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
    await updateDoc(collabRef, { 
      participantIds: arrayUnion(userId), 
      updatedAt: Timestamp.now() 
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
      const entry = {
        path,
        settings: settings ?? {
          eq: {
            highshelf: { gain: 0, frequency: 8000 },
            param2: { gain: 0, frequency: 3000, Q: 1 },
            param1: { gain: 0, frequency: 250, Q: 1 },
            highpass: { frequency: 20, enabled: false }
          },
          volume: { gain: 1 }
        }
      } as any;
      await updateDoc(collabRef, { 
        submissions: arrayUnion(entry), 
        updatedAt: Timestamp.now(), 
        unmoderatedSubmissions: needsMod 
      });
      await updateDoc(collabRef, { submissionPaths: arrayUnion(path) }).catch(() => {});
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

  static async setSubmissionApproved(): Promise<void> {
    return;
  }
}

