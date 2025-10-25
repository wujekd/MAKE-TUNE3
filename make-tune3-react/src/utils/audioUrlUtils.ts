import { ref, getDownloadURL } from 'firebase/storage';
import { storage } from '../services/firebase';

const urlCache = new Map<string, string>();

export class AudioUrlUtils {
  static async resolveAudioUrl(path: string): Promise<string> {
    if (!path) return '';
    if (path.startsWith('http')) return path;
    if (path.startsWith('/test-audio/')) return path;
    if (!path.startsWith('collabs/')) return `/test-audio/${path}`;
    
    const cached = urlCache.get(path);
    if (cached) return cached;
    
    const url = await getDownloadURL(ref(storage, path));
    urlCache.set(path, url);
    return url;
  }

  static clearCache(): void {
    urlCache.clear();
  }

  static getCacheSize(): number {
    return urlCache.size;
  }

  static getCachedUrl(path: string): string | undefined {
    return urlCache.get(path);
  }
}

