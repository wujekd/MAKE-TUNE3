export class PlaybackUtils {
  static formatTime(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  static calculateProgress(currentTime: number, duration: number): number {
    if (duration === 0) return 0;
    return (currentTime / duration) * 100;
  }

  static secondsToMilliseconds(seconds: number): number {
    return seconds * 1000;
  }

  static millisecondsToSeconds(milliseconds: number): number {
    return milliseconds / 1000;
  }
}

