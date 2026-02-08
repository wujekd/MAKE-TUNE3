import { ref, getDownloadURL } from 'firebase/storage';
import { storage } from '../services/firebase';

const urlCache = new Map<string, string>();
const DEBUG_PERFORMANCE = false;

export class AudioUrlUtils {
  static async resolveAudioUrl(path: string): Promise<string> {
    if (!path) return '';
    if (path.startsWith('http')) return path;
    if (!path.startsWith('collabs/')) return path;
    
    const cached = urlCache.get(path);
    if (cached) {
      if (DEBUG_PERFORMANCE) console.log('[AudioUrlUtils] Cache HIT:', path.substring(0, 50) + '...');
      return cached;
    }
    
    if (DEBUG_PERFORMANCE) {
      console.log('[AudioUrlUtils] Cache MISS - fetching from Firebase:', path.substring(0, 50) + '...');
      const start = performance.now();
      const url = await getDownloadURL(ref(storage, path));
      const duration = performance.now() - start;
      console.log(`[AudioUrlUtils] Firebase fetch took ${duration.toFixed(0)}ms`);
      urlCache.set(path, url);
      return url;
    } else {
      const url = await getDownloadURL(ref(storage, path));
      urlCache.set(path, url);
      return url;
    }
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
