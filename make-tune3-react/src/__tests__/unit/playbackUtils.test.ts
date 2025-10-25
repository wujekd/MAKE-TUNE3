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

  describe('calculateProgress', () => {
    it('should calculate progress percentage', () => {
      expect(PlaybackUtils.calculateProgress(0, 100)).toBe(0);
      expect(PlaybackUtils.calculateProgress(25, 100)).toBe(25);
      expect(PlaybackUtils.calculateProgress(50, 100)).toBe(50);
      expect(PlaybackUtils.calculateProgress(75, 100)).toBe(75);
      expect(PlaybackUtils.calculateProgress(100, 100)).toBe(100);
    });

    it('should handle zero duration', () => {
      expect(PlaybackUtils.calculateProgress(50, 0)).toBe(0);
    });

    it('should handle decimal values', () => {
      expect(PlaybackUtils.calculateProgress(33.33, 100)).toBeCloseTo(33.33, 2);
      expect(PlaybackUtils.calculateProgress(66.66, 100)).toBeCloseTo(66.66, 2);
    });

    it('should handle progress over 100%', () => {
      expect(PlaybackUtils.calculateProgress(150, 100)).toBe(150);
    });
  });

  describe('secondsToMilliseconds', () => {
    it('should convert seconds to milliseconds', () => {
      expect(PlaybackUtils.secondsToMilliseconds(0)).toBe(0);
      expect(PlaybackUtils.secondsToMilliseconds(1)).toBe(1000);
      expect(PlaybackUtils.secondsToMilliseconds(5)).toBe(5000);
      expect(PlaybackUtils.secondsToMilliseconds(60)).toBe(60000);
    });

    it('should handle decimal seconds', () => {
      expect(PlaybackUtils.secondsToMilliseconds(1.5)).toBe(1500);
      expect(PlaybackUtils.secondsToMilliseconds(0.001)).toBe(1);
    });
  });

  describe('millisecondsToSeconds', () => {
    it('should convert milliseconds to seconds', () => {
      expect(PlaybackUtils.millisecondsToSeconds(0)).toBe(0);
      expect(PlaybackUtils.millisecondsToSeconds(1000)).toBe(1);
      expect(PlaybackUtils.millisecondsToSeconds(5000)).toBe(5);
      expect(PlaybackUtils.millisecondsToSeconds(60000)).toBe(60);
    });

    it('should handle decimal milliseconds', () => {
      expect(PlaybackUtils.millisecondsToSeconds(1500)).toBe(1.5);
      expect(PlaybackUtils.millisecondsToSeconds(1)).toBe(0.001);
    });
  });
});

