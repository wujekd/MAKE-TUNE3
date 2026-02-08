import { describe, it, expect } from 'vitest';
import { TrackUtils } from '../../utils/trackUtils';
import type { Track, SubmissionSettings } from '../../types/collaboration';

describe('TrackUtils', () => {
  describe('createTrackFromFilePath', () => {
    it('should create a submission track from file path', () => {
      const track = TrackUtils.createTrackFromFilePath(
        'collabs/collab-1/submissions/sub-1.mp3',
        'submission',
        'collab-1'
      );

      expect(track.id).toBe('collabs/collab-1/submissions/sub-1.mp3');
      expect(track.filePath).toBe('collabs/collab-1/submissions/sub-1.mp3');
      expect(track.title).toBe('sub-1');
      expect(track.category).toBe('submission');
      expect(track.collaborationId).toBe('collab-1');
      expect(track.duration).toBe(0);
      expect(track.approved).toBe(false);
    });

    it('should create a backing track', () => {
      const track = TrackUtils.createTrackFromFilePath(
        'collabs/collab-1/backing.mp3',
        'backing',
        'collab-1'
      );

      expect(track.category).toBe('backing');
      expect(track.title).toBe('backing');
    });

    it('should create a past stage track', () => {
      const track = TrackUtils.createTrackFromFilePath(
        'collabs/collab-1/past/winner.mp3',
        'pastStage',
        'collab-1'
      );

      expect(track.category).toBe('pastStage');
    });

    it('should include submission settings when provided', () => {
      const settings: SubmissionSettings = {
        eq: {
          highshelf: { gain: 2, frequency: 8000 },
          param2: { gain: 1, frequency: 3000, Q: 1 },
          param1: { gain: -1, frequency: 250, Q: 1 },
          highpass: { frequency: 80, enabled: true }
        },
        volume: { gain: 0.8 }
      };

      const track = TrackUtils.createTrackFromFilePath(
        'path/to/track.mp3',
        'submission',
        'collab-1',
        { settings }
      );

      expect(track.submissionSettings).toEqual(settings);
    });

    it('should include optimized path when provided', () => {
      const track = TrackUtils.createTrackFromFilePath(
        'path/to/original.mp3',
        'submission',
        'collab-1',
        { optimizedPath: 'path/to/optimized.mp3' }
      );

      expect(track.filePath).toBe('path/to/original.mp3');
      expect(track.optimizedPath).toBe('path/to/optimized.mp3');
    });

    it('should remove file extension from title', () => {
      const track = TrackUtils.createTrackFromFilePath(
        'path/to/my-awesome-track.mp3',
        'submission',
        'collab-1'
      );

      expect(track.title).toBe('my-awesome-track');
    });

    it('should handle paths without extension', () => {
      const track = TrackUtils.createTrackFromFilePath(
        'path/to/track',
        'submission',
        'collab-1'
      );

      expect(track.title).toBe('track');
    });
  });

  describe('filterByFavorites', () => {
    const mockTracks: Track[] = [
      {
        id: 'track-1',
        title: 'Track 1',
        filePath: 'path/to/track1.mp3',
        duration: 180,
        createdAt: new Date() as any,
        collaborationId: 'collab-1',
        category: 'submission',
        approved: true
      },
      {
        id: 'track-2',
        title: 'Track 2',
        filePath: 'path/to/track2.mp3',
        duration: 200,
        createdAt: new Date() as any,
        collaborationId: 'collab-1',
        category: 'submission',
        approved: true
      },
      {
        id: 'track-3',
        title: 'Track 3',
        filePath: 'path/to/track3.mp3',
        duration: 220,
        createdAt: new Date() as any,
        collaborationId: 'collab-1',
        category: 'submission',
        approved: true
      }
    ];

    it('should split tracks into favorites and regular', () => {
      const favoriteFilePaths = ['path/to/track1.mp3', 'path/to/track3.mp3'];

      const result = TrackUtils.filterByFavorites(mockTracks, favoriteFilePaths);

      expect(result.favorites).toHaveLength(2);
      expect(result.regular).toHaveLength(1);
      expect(result.favorites[0].id).toBe('track-1');
      expect(result.favorites[1].id).toBe('track-3');
      expect(result.regular[0].id).toBe('track-2');
    });

    it('should return all tracks as regular when no favorites', () => {
      const result = TrackUtils.filterByFavorites(mockTracks, []);

      expect(result.favorites).toHaveLength(0);
      expect(result.regular).toHaveLength(3);
    });

    it('should return all tracks as favorites when all are favorited', () => {
      const favoriteFilePaths = mockTracks.map(t => t.filePath);

      const result = TrackUtils.filterByFavorites(mockTracks, favoriteFilePaths);

      expect(result.favorites).toHaveLength(3);
      expect(result.regular).toHaveLength(0);
    });

    it('should handle empty track list', () => {
      const result = TrackUtils.filterByFavorites([], ['any-path.mp3']);

      expect(result.favorites).toHaveLength(0);
      expect(result.regular).toHaveLength(0);
    });
  });

  describe('findTrackByFilePath', () => {
    const mockTracks: Track[] = [
      {
        id: 'track-1',
        title: 'Track 1',
        filePath: 'path/to/track1.mp3',
        duration: 180,
        createdAt: new Date() as any,
        collaborationId: 'collab-1',
        category: 'submission',
        approved: true
      },
      {
        id: 'track-2',
        title: 'Track 2',
        filePath: 'path/to/track2.mp3',
        duration: 200,
        createdAt: new Date() as any,
        collaborationId: 'collab-1',
        category: 'submission',
        approved: true
      }
    ];

    it('should find track by exact file path', () => {
      const track = TrackUtils.findTrackByFilePath(mockTracks, 'path/to/track1.mp3');

      expect(track).toBeDefined();
      expect(track?.id).toBe('track-1');
    });

    it('should return undefined for non-existent path', () => {
      const track = TrackUtils.findTrackByFilePath(mockTracks, 'non-existent.mp3');

      expect(track).toBeUndefined();
    });

    it('should handle empty track list', () => {
      const track = TrackUtils.findTrackByFilePath([], 'any-path.mp3');

      expect(track).toBeUndefined();
    });
  });

  describe('isTrackInList', () => {
    const mockTracks: Track[] = [
      {
        id: 'track-1',
        title: 'Track 1',
        filePath: 'path/to/track1.mp3',
        duration: 180,
        createdAt: new Date() as any,
        collaborationId: 'collab-1',
        category: 'submission',
        approved: true
      }
    ];

    it('should return true when track is in list', () => {
      const result = TrackUtils.isTrackInList(mockTracks, 'path/to/track1.mp3');

      expect(result).toBe(true);
    });

    it('should return false when track is not in list', () => {
      const result = TrackUtils.isTrackInList(mockTracks, 'other-path.mp3');

      expect(result).toBe(false);
    });

    it('should handle empty list', () => {
      const result = TrackUtils.isTrackInList([], 'any-path.mp3');

      expect(result).toBe(false);
    });
  });

  describe('updateTrackApprovalStatus', () => {
    const mockTracks: Track[] = [
      {
        id: 'track-1',
        title: 'Track 1',
        filePath: 'path/to/track1.mp3',
        duration: 180,
        createdAt: new Date() as any,
        collaborationId: 'collab-1',
        category: 'submission',
        approved: false
      },
      {
        id: 'track-2',
        title: 'Track 2',
        filePath: 'path/to/track2.mp3',
        duration: 200,
        createdAt: new Date() as any,
        collaborationId: 'collab-1',
        category: 'submission',
        approved: true
      }
    ];

    it('should approve a track', () => {
      const updated = TrackUtils.updateTrackApprovalStatus(
        mockTracks,
        'path/to/track1.mp3',
        true,
        'approved'
      );

      const track = updated.find(t => t.filePath === 'path/to/track1.mp3');
      expect(track?.approved).toBe(true);
      expect(track?.moderationStatus).toBe('approved');
    });

    it('should reject a track', () => {
      const updated = TrackUtils.updateTrackApprovalStatus(
        mockTracks,
        'path/to/track2.mp3',
        false,
        'rejected'
      );

      const track = updated.find(t => t.filePath === 'path/to/track2.mp3');
      expect(track?.approved).toBe(false);
      expect(track?.moderationStatus).toBe('rejected');
    });

    it('should not modify other tracks', () => {
      const updated = TrackUtils.updateTrackApprovalStatus(
        mockTracks,
        'path/to/track1.mp3',
        true,
        'approved'
      );

      const track2 = updated.find(t => t.filePath === 'path/to/track2.mp3');
      expect(track2?.approved).toBe(true);
      expect(track2?.moderationStatus).toBeUndefined();
    });

    it('should return new array (immutable)', () => {
      const updated = TrackUtils.updateTrackApprovalStatus(
        mockTracks,
        'path/to/track1.mp3',
        true,
        'approved'
      );

      expect(updated).not.toBe(mockTracks);
      expect(mockTracks[0].approved).toBe(false); // Original unchanged
    });
  });
});
