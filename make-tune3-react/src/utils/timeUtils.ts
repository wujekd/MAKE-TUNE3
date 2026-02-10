export interface CountdownResult {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  completed: boolean;
}

export class TimeUtils {
  static formatCountdown(target: Date | number): CountdownResult {
    const now = Date.now();
    const targetMs = target instanceof Date ? target.getTime() : target * 1000;
    const diff = targetMs - now;

    if (diff <= 0) {
      return { days: 0, hours: 0, minutes: 0, seconds: 0, completed: true };
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    return { days, hours, minutes, seconds, completed: false };
  }

  static clampDuration(seconds: number): number {
    const min = 60; // 1 minute minimum
    const max = 60 * 60 * 24 * 14; // 14 days maximum
    return Math.max(min, Math.min(max, seconds));
  }

  static formatDate(target: Date | number, options?: { short?: boolean }): string {
    if (!target) return 'N/A';
    const date = target instanceof Date ? target : new Date(target);

    if (options?.short) {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
      });
    }

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
}
