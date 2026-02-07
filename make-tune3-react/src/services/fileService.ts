import { ref, uploadBytesResumable } from 'firebase/storage';
import { storage } from './firebase';
import { MAX_SUBMISSION_FILE_SIZE, MAX_PDF_FILE_SIZE, MAX_ZIP_FILE_SIZE } from '../config';

export class FileService {
  static getPreferredAudioExtension(file: File): string {
    const allowed = new Set(['mp3', 'wav', 'flac', 'ogg', 'm4a', 'aac', 'webm', 'opus']);
    const nameExt = (file.name.split('.').pop() || '').toLowerCase();
    if (allowed.has(nameExt)) return nameExt;
    const mimeToExt: Record<string, string> = {
      'audio/mpeg': 'mp3',
      'audio/wav': 'wav',
      'audio/x-wav': 'wav',
      'audio/flac': 'flac',
      'audio/x-flac': 'flac',
      'audio/ogg': 'ogg',
      'audio/opus': 'opus',
      'audio/mp4': 'm4a',
      'audio/aac': 'aac',
      'audio/x-m4a': 'm4a',
      'audio/webm': 'webm'
    };
    return mimeToExt[file.type] || 'audio';
  }

  static validateFileSize(file: File): void {
    if (file.size >= MAX_SUBMISSION_FILE_SIZE) {
      throw new Error(`File too large. Maximum size is ${Math.round(MAX_SUBMISSION_FILE_SIZE / 1024 / 1024)}MB.`);
    }
  }

  static validatePdfFile(file: File): void {
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    if (ext !== 'pdf' && file.type !== 'application/pdf') {
      throw new Error('File must be a PDF.');
    }
    if (file.size >= MAX_PDF_FILE_SIZE) {
      throw new Error(`PDF too large. Maximum size is ${Math.round(MAX_PDF_FILE_SIZE / 1024 / 1024)}MB.`);
    }
  }

  static validateZipFile(file: File): void {
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    const validTypes = ['application/zip', 'application/x-zip-compressed', 'application/x-zip'];
    if (ext !== 'zip' && !validTypes.includes(file.type)) {
      throw new Error('File must be a ZIP archive.');
    }
    if (file.size >= MAX_ZIP_FILE_SIZE) {
      throw new Error(`ZIP too large. Maximum size is ${Math.round(MAX_ZIP_FILE_SIZE / 1024 / 1024)}MB.`);
    }
  }

  static async uploadFile(
    file: File,
    path: string,
    onProgress?: (percent: number) => void,
    metadata?: Record<string, string>
  ): Promise<void> {
    const storageRef = ref(storage, path);
    const task = uploadBytesResumable(storageRef, file, {
      contentType: file.type,
      customMetadata: metadata
    });
    
    await new Promise<void>((resolve, reject) => {
      task.on(
        'state_changed',
        (snap) => {
          if (onProgress) {
            const pct = (snap.bytesTransferred / snap.totalBytes) * 100;
            onProgress(Math.round(pct));
          }
        },
        (err) => reject(err),
        () => resolve()
      );
    });
  }

  static async uploadPdf(
    file: File,
    collaborationId: string,
    onProgress?: (percent: number) => void
  ): Promise<string> {
    this.validatePdfFile(file);
    const path = `collabs/${collaborationId}/docs/instructions.pdf`;
    await this.uploadFile(file, path, onProgress);
    return path;
  }

  static async uploadResourcesZip(
    file: File,
    collaborationId: string,
    onProgress?: (percent: number) => void
  ): Promise<string> {
    this.validateZipFile(file);
    const path = `collabs/${collaborationId}/docs/resources.zip`;
    await this.uploadFile(file, path, onProgress);
    return path;
  }

  static async uploadSubmissionMultitracks(
    file: File,
    collaborationId: string,
    submissionId: string,
    onProgress?: (percent: number) => void,
    ownerUid?: string,
    uploadTokenId?: string
  ): Promise<string> {
    this.validateZipFile(file);
    const path = `collabs/${collaborationId}/submissions/${submissionId}-multitracks.zip`;
    const metadata: Record<string, string> = {
      submissionId
    };
    if (ownerUid) {
      metadata.ownerUid = ownerUid;
    }
    if (uploadTokenId) {
      metadata.uploadTokenId = uploadTokenId;
    }
    await this.uploadFile(file, path, onProgress, metadata);
    return path;
  }
}
