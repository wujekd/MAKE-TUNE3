import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AudioUrlUtils } from '../../utils/audioUrlUtils';

vi.mock('firebase/storage', () => ({
  ref: vi.fn(),
  getDownloadURL: vi.fn()
}));

vi.mock('../../services/firebase', () => ({
  storage: {}
}));

import { getDownloadURL } from 'firebase/storage';

describe('AudioUrlUtils', () => {
  beforeEach(() => {
    AudioUrlUtils.clearCache();
    vi.clearAllMocks();
  });

  afterEach(() => {
    AudioUrlUtils.clearCache();
  });

  describe('resolveAudioUrl', () => {
    it('should return empty string for empty path', async () => {
      const result = await AudioUrlUtils.resolveAudioUrl('');
      expect(result).toBe('');
    });

    it('should return http URLs as-is', async () => {
      const url = 'https://example.com/audio.mp3';
      const result = await AudioUrlUtils.resolveAudioUrl(url);
      expect(result).toBe(url);
    });

    it('should return test-audio paths as-is', async () => {
      const path = '/test-audio/mock.mp3';
      const result = await AudioUrlUtils.resolveAudioUrl(path);
      expect(result).toBe(path);
    });

    it('should return non-collabs paths as-is', async () => {
      const path = 'some-file.mp3';
      const result = await AudioUrlUtils.resolveAudioUrl(path);
      expect(result).toBe('some-file.mp3');
    });

    it('should fetch and cache Firebase Storage URLs', async () => {
      const path = 'collabs/collab-1/backing.mp3';
      const mockUrl = 'https://storage.googleapis.com/bucket/collabs/collab-1/backing.mp3';
      
      vi.mocked(getDownloadURL).mockResolvedValue(mockUrl);

      const result = await AudioUrlUtils.resolveAudioUrl(path);
      
      expect(result).toBe(mockUrl);
      expect(getDownloadURL).toHaveBeenCalledTimes(1);
    });

    it('should return cached URL on second call', async () => {
      const path = 'collabs/collab-1/backing.mp3';
      const mockUrl = 'https://storage.googleapis.com/bucket/collabs/collab-1/backing.mp3';
      
      vi.mocked(getDownloadURL).mockResolvedValue(mockUrl);

      const result1 = await AudioUrlUtils.resolveAudioUrl(path);
      const result2 = await AudioUrlUtils.resolveAudioUrl(path);
      
      expect(result1).toBe(mockUrl);
      expect(result2).toBe(mockUrl);
      expect(getDownloadURL).toHaveBeenCalledTimes(1);
    });
  });

  describe('cache management', () => {
    it('should clear cache', async () => {
      const path = 'collabs/collab-1/backing.mp3';
      const mockUrl = 'https://storage.googleapis.com/bucket/collabs/collab-1/backing.mp3';
      
      vi.mocked(getDownloadURL).mockResolvedValue(mockUrl);

      await AudioUrlUtils.resolveAudioUrl(path);
      expect(AudioUrlUtils.getCacheSize()).toBe(1);
      
      AudioUrlUtils.clearCache();
      expect(AudioUrlUtils.getCacheSize()).toBe(0);
    });

    it('should return cache size', async () => {
      const path1 = 'collabs/collab-1/backing.mp3';
      const path2 = 'collabs/collab-1/submission1.mp3';
      
      vi.mocked(getDownloadURL).mockResolvedValue('https://example.com/url');

      expect(AudioUrlUtils.getCacheSize()).toBe(0);
      
      await AudioUrlUtils.resolveAudioUrl(path1);
      expect(AudioUrlUtils.getCacheSize()).toBe(1);
      
      await AudioUrlUtils.resolveAudioUrl(path2);
      expect(AudioUrlUtils.getCacheSize()).toBe(2);
    });

    it('should get cached URL', async () => {
      const path = 'collabs/collab-1/backing.mp3';
      const mockUrl = 'https://storage.googleapis.com/bucket/collabs/collab-1/backing.mp3';
      
      vi.mocked(getDownloadURL).mockResolvedValue(mockUrl);

      expect(AudioUrlUtils.getCachedUrl(path)).toBeUndefined();
      
      await AudioUrlUtils.resolveAudioUrl(path);
      expect(AudioUrlUtils.getCachedUrl(path)).toBe(mockUrl);
    });
  });
});
