import { describe, it, expect, beforeEach } from 'vitest';
import { FileService } from '../../services/fileService';
import { MAX_SUBMISSION_FILE_SIZE } from '../../config';

describe('FileService', () => {
  describe('validateFileSize', () => {
    it('should accept files under 100MB', () => {
      const mockFile = { size: 50 * 1024 * 1024, name: 'test.mp3', type: 'audio/mpeg' } as File;
      
      expect(() => FileService.validateFileSize(mockFile)).not.toThrow();
    });

    it('should accept files exactly at the limit', () => {
      const mockFile = { size: MAX_SUBMISSION_FILE_SIZE - 1, name: 'test.mp3', type: 'audio/mpeg' } as File;
      
      expect(() => FileService.validateFileSize(mockFile)).not.toThrow();
    });

    it('should reject files at or over the size limit', () => {
      const mockFile = { size: MAX_SUBMISSION_FILE_SIZE, name: 'test.mp3', type: 'audio/mpeg' } as File;
      
      expect(() => FileService.validateFileSize(mockFile)).toThrow('File too large');
    });

    it('should reject files significantly over the limit', () => {
      const mockFile = { size: MAX_SUBMISSION_FILE_SIZE + 10000000, name: 'test.mp3', type: 'audio/mpeg' } as File;
      
      expect(() => FileService.validateFileSize(mockFile)).toThrow('File too large');
    });

    it('should throw descriptive error for oversized files', () => {
      const mockFile = { size: MAX_SUBMISSION_FILE_SIZE, name: 'test.mp3', type: 'audio/mpeg' } as File;
      const expectedSize = Math.round(MAX_SUBMISSION_FILE_SIZE / 1024 / 1024);
      
      expect(() => FileService.validateFileSize(mockFile)).toThrow(`Maximum size is ${expectedSize}MB`);
    });

    it('should handle zero-byte files', () => {
      const file = new File([], 'empty.mp3', { type: 'audio/mpeg' });
      
      expect(() => FileService.validateFileSize(file)).not.toThrow();
    });
  });

  describe('getPreferredAudioExtension', () => {
    describe('from file name', () => {
      it('should return mp3 for .mp3 files', () => {
        const file = new File([], 'test.mp3', { type: 'audio/mpeg' });
        expect(FileService.getPreferredAudioExtension(file)).toBe('mp3');
      });

      it('should return wav for .wav files', () => {
        const file = new File([], 'test.wav', { type: 'audio/wav' });
        expect(FileService.getPreferredAudioExtension(file)).toBe('wav');
      });

      it('should return flac for .flac files', () => {
        const file = new File([], 'test.flac', { type: 'audio/flac' });
        expect(FileService.getPreferredAudioExtension(file)).toBe('flac');
      });

      it('should return ogg for .ogg files', () => {
        const file = new File([], 'test.ogg', { type: 'audio/ogg' });
        expect(FileService.getPreferredAudioExtension(file)).toBe('ogg');
      });

      it('should return m4a for .m4a files', () => {
        const file = new File([], 'test.m4a', { type: 'audio/mp4' });
        expect(FileService.getPreferredAudioExtension(file)).toBe('m4a');
      });

      it('should return aac for .aac files', () => {
        const file = new File([], 'test.aac', { type: 'audio/aac' });
        expect(FileService.getPreferredAudioExtension(file)).toBe('aac');
      });

      it('should return webm for .webm files', () => {
        const file = new File([], 'test.webm', { type: 'audio/webm' });
        expect(FileService.getPreferredAudioExtension(file)).toBe('webm');
      });

      it('should return opus for .opus files', () => {
        const file = new File([], 'test.opus', { type: 'audio/opus' });
        expect(FileService.getPreferredAudioExtension(file)).toBe('opus');
      });

      it('should be case-insensitive for file extensions', () => {
        const file1 = new File([], 'test.MP3', { type: 'audio/mpeg' });
        const file2 = new File([], 'test.Mp3', { type: 'audio/mpeg' });
        const file3 = new File([], 'test.WAV', { type: 'audio/wav' });
        
        expect(FileService.getPreferredAudioExtension(file1)).toBe('mp3');
        expect(FileService.getPreferredAudioExtension(file2)).toBe('mp3');
        expect(FileService.getPreferredAudioExtension(file3)).toBe('wav');
      });
    });

    describe('from MIME type', () => {
      it('should return mp3 for audio/mpeg', () => {
        const file = new File([], 'test', { type: 'audio/mpeg' });
        expect(FileService.getPreferredAudioExtension(file)).toBe('mp3');
      });

      it('should return wav for audio/wav', () => {
        const file = new File([], 'test', { type: 'audio/wav' });
        expect(FileService.getPreferredAudioExtension(file)).toBe('wav');
      });

      it('should return wav for audio/x-wav', () => {
        const file = new File([], 'test', { type: 'audio/x-wav' });
        expect(FileService.getPreferredAudioExtension(file)).toBe('wav');
      });

      it('should return flac for audio/flac', () => {
        const file = new File([], 'test', { type: 'audio/flac' });
        expect(FileService.getPreferredAudioExtension(file)).toBe('flac');
      });

      it('should return flac for audio/x-flac', () => {
        const file = new File([], 'test', { type: 'audio/x-flac' });
        expect(FileService.getPreferredAudioExtension(file)).toBe('flac');
      });

      it('should return ogg for audio/ogg', () => {
        const file = new File([], 'test', { type: 'audio/ogg' });
        expect(FileService.getPreferredAudioExtension(file)).toBe('ogg');
      });

      it('should return opus for audio/opus', () => {
        const file = new File([], 'test', { type: 'audio/opus' });
        expect(FileService.getPreferredAudioExtension(file)).toBe('opus');
      });

      it('should return m4a for audio/mp4', () => {
        const file = new File([], 'test', { type: 'audio/mp4' });
        expect(FileService.getPreferredAudioExtension(file)).toBe('m4a');
      });

      it('should return m4a for audio/x-m4a', () => {
        const file = new File([], 'test', { type: 'audio/x-m4a' });
        expect(FileService.getPreferredAudioExtension(file)).toBe('m4a');
      });

      it('should return aac for audio/aac', () => {
        const file = new File([], 'test', { type: 'audio/aac' });
        expect(FileService.getPreferredAudioExtension(file)).toBe('aac');
      });

      it('should return webm for audio/webm', () => {
        const file = new File([], 'test', { type: 'audio/webm' });
        expect(FileService.getPreferredAudioExtension(file)).toBe('webm');
      });
    });

    describe('fallback behavior', () => {
      it('should return "audio" for unknown MIME types', () => {
        const file = new File([], 'test', { type: 'audio/unknown' });
        expect(FileService.getPreferredAudioExtension(file)).toBe('audio');
      });

      it('should return "audio" for non-audio MIME types', () => {
        const file = new File([], 'test', { type: 'video/mp4' });
        expect(FileService.getPreferredAudioExtension(file)).toBe('audio');
      });

      it('should return "audio" for empty MIME type', () => {
        const file = new File([], 'test', { type: '' });
        expect(FileService.getPreferredAudioExtension(file)).toBe('audio');
      });

      it('should prioritize file extension over MIME type', () => {
        const file = new File([], 'test.mp3', { type: 'audio/wav' });
        expect(FileService.getPreferredAudioExtension(file)).toBe('mp3');
      });

      it('should handle files with no extension', () => {
        const file = new File([], 'test', { type: 'audio/mpeg' });
        expect(FileService.getPreferredAudioExtension(file)).toBe('mp3');
      });

      it('should handle files with multiple dots', () => {
        const file = new File([], 'my.test.file.mp3', { type: 'audio/mpeg' });
        expect(FileService.getPreferredAudioExtension(file)).toBe('mp3');
      });
    });

    describe('edge cases', () => {
      it('should handle files with disallowed extensions', () => {
        const file = new File([], 'test.txt', { type: 'text/plain' });
        expect(FileService.getPreferredAudioExtension(file)).toBe('audio');
      });

      it('should handle files with no name', () => {
        const file = new File([], '', { type: 'audio/mpeg' });
        expect(FileService.getPreferredAudioExtension(file)).toBe('mp3');
      });
    });
  });
});

