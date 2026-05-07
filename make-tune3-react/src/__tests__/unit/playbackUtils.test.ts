import { describe, it, expect } from 'vitest';
import { PlaybackUtils } from '../../utils/playbackUtils';

describe('PlaybackUtils', () => {
  describe('formatTime', () => {
    it('should format seconds as mm:ss', () => {
      expect(PlaybackUtils.formatTime(0)).toBe('0:00');
      expect(PlaybackUtils.formatTime(30)).toBe('0:30');
      expect(PlaybackUtils.formatTime(60)).toBe('1:00');
      expect(PlaybackUtils.formatTime(90)).toBe('1:30');
      expect(PlaybackUtils.formatTime(125)).toBe('2:05');
      expect(PlaybackUtils.formatTime(3661)).toBe('61:01');
    });

    it('should pad seconds with leading zero', () => {
      expect(PlaybackUtils.formatTime(5)).toBe('0:05');
      expect(PlaybackUtils.formatTime(65)).toBe('1:05');
      expect(PlaybackUtils.formatTime(605)).toBe('10:05');
    });

    it('should handle decimal seconds', () => {
      expect(PlaybackUtils.formatTime(30.7)).toBe('0:30');
      expect(PlaybackUtils.formatTime(90.9)).toBe('1:30');
    });

    it('should handle negative values', () => {
      expect(PlaybackUtils.formatTime(-30)).toBe('-1:-30');
    });
  });
});
