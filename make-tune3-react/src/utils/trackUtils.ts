import type { Track, SubmissionSettings } from '../types/collaboration';

/**
 * Track utility functions for transforming and filtering track data.
 * Pure functions with no side effects or Firebase dependencies.
 */
export class TrackUtils {
  /**
   * Create a Track object from a file path
   */
  static createTrackFromFilePath(
    filePath: string,
    category: 'backing' | 'submission' | 'pastStage',
    collaborationId: string,
    settings?: SubmissionSettings,
    optimizedPath?: string
  ): Track {
    const fileName = filePath.split('/').pop() || filePath;
    const title = fileName.replace(/\.[^/.]+$/, ''); // Remove extension

    return {
      id: filePath, // Use filePath as id
      title,
      filePath,
      optimizedPath,
      duration: 0, // Set by audio engine
      createdAt: new Date() as any,
      collaborationId,
      category,
      approved: true, // Default approved
      submissionSettings: settings
    };
  }

  /**
   * Filter tracks into favorites and regular lists
   */
  static filterByFavorites(
    allTracks: Track[],
    favoriteFilePaths: string[]
  ): { favorites: Track[]; regular: Track[] } {
    const favorites = allTracks.filter(track =>
      favoriteFilePaths.includes(track.filePath)
    );

    const regular = allTracks.filter(track =>
      !favoriteFilePaths.includes(track.filePath)
    );

    return { favorites, regular };
  }

  /**
   * Find a track by its file path
   */
  static findTrackByFilePath(
    tracks: Track[],
    filePath: string
  ): Track | undefined {
    return tracks.find(track => track.filePath === filePath);
  }

  /**
   * Check if a track exists in the list
   */
  static isTrackInList(tracks: Track[], filePath: string): boolean {
    return tracks.some(track => track.filePath === filePath);
  }

  /**
   * Update approval status for a specific track (immutable)
   */
  static updateTrackApprovalStatus(
    tracks: Track[],
    filePath: string,
    approved: boolean
  ): Track[] {
    return tracks.map(track =>
      track.filePath === filePath
        ? { ...track, approved }
        : track
    );
  }
}

