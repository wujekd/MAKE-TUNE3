export class PlaybackTracker {
    private static readonly DEBUG = false;
    
    private currentTrack: string | null = null;
    private startTime: number = 0;
    private totalPlayTime: number = 0;
    private isContinuous: boolean = true;
    private lastLogTime: number = 0;
    private listenRatio: number;
    private onTrackListened: (trackSrc: string) => void;
    
    constructor(onTrackListened: (trackSrc: string) => void) {
      this.onTrackListened = onTrackListened;
      this.listenRatio = 80; // Default value
      console.log("playback tracker init with default ratio: ", this.listenRatio);
    }
    
    setListenRatio(ratio: number): void {
      this.listenRatio = ratio;
      console.log("playback tracker ratio updated to: ", this.listenRatio);
    }
    startTracking(trackSrc: string): void {
      if (PlaybackTracker.DEBUG) console.log('PlaybackTracker: Starting tracking for', trackSrc);
      this.currentTrack = trackSrc;
      this.startTime = Date.now();
      this.totalPlayTime = 0;
      this.isContinuous = true;
      this.lastLogTime = 0;
    }
    pauseTracking(): void {
      if (this.currentTrack && this.isContinuous) {
        this.totalPlayTime += Date.now() - this.startTime;
        if (PlaybackTracker.DEBUG) console.log('PlaybackTracker: Paused tracking, total play time:', this.totalPlayTime);
      }
    }
    resumeTracking(): void {
      if (this.currentTrack) {
        this.startTime = Date.now();
        if (PlaybackTracker.DEBUG) console.log('PlaybackTracker: Resumed tracking');
      }
    }
    stopTracking(): void {
      if (PlaybackTracker.DEBUG) console.log('PlaybackTracker: Stopped tracking');
      this.currentTrack = null;
      this.startTime = 0;
      this.totalPlayTime = 0;
      this.isContinuous = false;
      this.lastLogTime = 0;
    }
    updateProgress(currentTime: number, duration: number): void {
      if (!this.currentTrack || !this.isContinuous || duration === 0) return;
      const currentTimeSeconds = Math.floor(currentTime);
      if (currentTimeSeconds > this.lastLogTime) {
        this.lastLogTime = currentTimeSeconds;
        if (PlaybackTracker.DEBUG) console.log(`PlaybackTracker: ${currentTimeSeconds}s / ${Math.floor(duration)}s (${Math.round((currentTime / duration) * 100)}%)`);
      }
      const progress = (currentTime / duration) * 100;
      if (progress >= this.listenRatio) {
        if (PlaybackTracker.DEBUG) console.log(`PlaybackTracker: Track listened to ${this.listenRatio}% - marking as listened`);
        this.onTrackListened(this.currentTrack);
        this.stopTracking();
      }
    }
  }
