import { ref, uploadBytesResumable } from 'firebase/storage';
import { storage } from './firebase';
import { MAX_SUBMISSION_FILE_SIZE } from '../config';

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

  static async uploadFile(
    file: File,
    path: string,
    onProgress?: (percent: number) => void
  ): Promise<void> {
    const storageRef = ref(storage, path);
    const task = uploadBytesResumable(storageRef, file, { contentType: file.type });
    
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
}

