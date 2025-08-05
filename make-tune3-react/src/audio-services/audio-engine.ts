import type { AudioState } from '../types.ts';
import { PlaybackTracker } from './playback-tracker.ts';

export class AudioEngine {
  private player1: HTMLAudioElement;
  private player2: HTMLAudioElement;
  private audioContext: AudioContext;
  private player1Source: MediaElementAudioSourceNode | null = null;
  private player2Source: MediaElementAudioSourceNode | null = null;
  private player1Gain: GainNode | null = null;
  private player2Gain: GainNode | null = null;
  private masterGain: GainNode | null = null;
  private state: AudioState;
  private onStateChange?: (state: AudioState) => void;
  private playbackTracker: PlaybackTracker;
  private onTrackListened?: (trackSrc: string)=>void;
  private listenedRatio?: number;

  constructor(player1: HTMLAudioElement, player2: HTMLAudioElement, ) {
    this.player1 = player1;
    this.player2 = player2;
    // dont create right away, wait for user interaction - thanks chrome
    this.audioContext = null as any;
    this.state = {
      playerController: { playingFavourite: false, pastStagePlayback: false, currentTrackId: -1 },
      player1: { isPlaying: false, currentTime: 0, duration: 0, volume: 1, source: null, hasEnded: false, error: null },
      player2: { isPlaying: false, currentTime: 0, duration: 0, volume: 1, source: null, hasEnded: false, error: null },
      master: { volume: 1 }
    };
    this.setupAudioEventListeners();
    this.playbackTracker = new PlaybackTracker(
      (trackSrc) => this.onTrackListened?.(trackSrc)
    );
  }

// AUDIO INIT
  private initAudioContext(): AudioContext {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.setupAudioRouting();
      this.connectPlayerToAudioContext(1);
      this.connectPlayerToAudioContext(2);
    }
    return this.audioContext;
  }
  private setupAudioRouting(): void {
    if (!this.audioContext) return;
    
    this.player1Gain = this.audioContext.createGain();
    this.player2Gain = this.audioContext.createGain();
    
    this.masterGain = this.audioContext.createGain();
    
    this.player1Gain.connect(this.masterGain);
    this.player2Gain.connect(this.masterGain);
    this.masterGain.connect(this.audioContext.destination);
    
    this.player1Gain.gain.value = this.state.player1.volume;
    this.player2Gain.gain.value = this.state.player2.volume;
    this.masterGain.gain.value = this.state.master.volume;
  }
  private connectPlayerToAudioContext(playerId: 1 | 2): void {
    const player = playerId === 1 ? this.player1 : this.player2;
    const gainNode = playerId === 1 ? this.player1Gain : this.player2Gain;
    
    const source = this.audioContext.createMediaElementSource(player);
    if (gainNode) {
      source.connect(gainNode);
    }
    if (playerId === 1) {
      this.player1Source = source;
    } else {
      this.player2Source = source;
    }
  }

// PLAYBACK METHODS
  loadSource(playerId: 1 | 2, src: string): void {
    const player = playerId === 1 ? this.player1 : this.player2;
    player.src = src;
    player.load();
    if (playerId === 1) {
      this.player2.currentTime = 0;
    }
    
    this.updateState({
      [`player${playerId}`]: { 
        ...this.state[`player${playerId}`], 
        source: src,
        isPlaying: false,  // play state for new source
        hasEnded: false,
        currentTime: 0
      },
      // update p2 ime in state on reset
      ...(playerId === 1 && {
        player2: {
          ...this.state.player2,
          currentTime: 0
        }
      })
    });
  }
  playSubmission(submissionSrc: string, backingSrc: string, index: number): void {
    this.initAudioContext();
    this.loadSource(1, submissionSrc);
    this.loadSource(2, backingSrc);
    this.state.playerController.pastStagePlayback = false;
    this.state.playerController.currentTrackId = index;
    this.updateState({
      player1: {
        ...this.state.player1, 
        isPlaying: true 
      },
      player2: {
        ...this.state.player2, 
        isPlaying: true 
      }
    });
    this.playbackTracker.startTracking(submissionSrc);
    this.player1.play();
    this.player2.play();
  } 
  playPastStage(src: string, index: number){
    this.initAudioContext();
    this.loadSource(2, src);
    this.player1.pause();
    this.player2.play();
    this.state.playerController.pastStagePlayback = true;
    this.state.playerController.currentTrackId = index;
    this.updateState({
      player2: {
        ...this.state.player2,
        isPlaying: true
      }
    });
  }
  pause(): void {
    this.player1.pause();
    this.player2.pause();
    this.updateState({
      player1: {
        ...this.state.player1,
        isPlaying: false
      },
      player2: {
        ...this.state.player2,
        isPlaying: false
      }
    });
    this.playbackTracker.pauseTracking();
  }
  stop(playerId: 1 | 2): void {
    const player = playerId === 1 ? this.player1 : this.player2;
    player.pause();
    player.currentTime = 0;
  }
  togglePlayback(): void {
    if (!this.state.playerController.pastStagePlayback) {
      this.toggleBoth();
    } else {
      this.toggleP2();
    }
  }
  toggleP2(): void {
    this.initAudioContext();
    const state = this.getState();
    if (state.player2.isPlaying) {
      this.player2.pause();
      this.updateState({
        player2: { ...this.state.player2, isPlaying: false }
      });
    } else {
      this.player2.play();
      this.updateState({
        player2: { ...this.state.player2, isPlaying: true }
      });
    }
  }
  toggleBoth(): void {
    this.initAudioContext();
    const state = this.getState();
    const player1Playing = state.player1.isPlaying;
    const player2Playing = state.player2.isPlaying;
    
    if (player1Playing || player2Playing) {
      this.pause();
    } else {
      this.player1.play();
      this.player2.play();
      this.updateState({
        player1: { ...this.state.player1, isPlaying: true },
        player2: { ...this.state.player2, isPlaying: true }
      });
    }
  }
  setVolume(playerId: 1 | 2, volume: number): void {
    this.initAudioContext();
    const player = playerId === 1 ? this.player1 : this.player2;
    const gainNode = playerId === 1 ? this.player1Gain : this.player2Gain;
    if (gainNode) {
      gainNode.gain.value = volume;
    }
    this.updateState({
      [`player${playerId}`]: {
        ...this.state[`player${playerId}`],
        volume: volume 
      }
    });
  }
  setMasterVolume(volume: number): void {
    this.initAudioContext();
    if (this.masterGain) {
      this.masterGain.gain.value = volume;
    }
    this.updateState({
      master: { volume: volume }
    });
  }
  setPlayingFavourite(value: boolean): void {
    this.updateState({
      playerController: {
        ...this.state.playerController,
        playingFavourite: value
      }
    });
  }
  updateCurrentTrackId(trackId: number): void {
    console.log("updateCurrentTrackId called with:", trackId);
    console.log("updateCurrentTrackId - old currentTrackId:", this.state.playerController.currentTrackId);
    this.updateState({
      playerController: {
        ...this.state.playerController,
        currentTrackId: trackId
      }
    });
    console.log("updateCurrentTrackId - new currentTrackId:", this.state.playerController.currentTrackId);
  }
  seek(time: number, pastStagePlayback: boolean = false): void {
    if (pastStagePlayback) {
      // seek player2 when in pastStagePlayback mode
      this.player2.currentTime = time;
      this.updateState({
        player2: { 
          ...this.state.player2, 
          currentTime: time 
        }
      });
    } else {
      // both players in normal mode
      this.player1.currentTime = time;
      this.player2.currentTime = time;
      this.updateState({
        player1: { 
          ...this.state.player1, 
          currentTime: time 
        },
        player2: { 
          ...this.state.player2, 
          currentTime: time 
        }
      });
      this.playbackTracker.stopTracking();
    }
  }

// STATE METHODS
  setCallbacks(onStateChange: (state: AudioState) => void) {
    this.onStateChange = onStateChange;
  }
  setTrackListenedCallback(callback: (trackSrc: string) => void, listenedRatio: number): void {
    this.onTrackListened = callback;
    this.listenedRatio = listenedRatio;
    this.playbackTracker.setListenRatio(listenedRatio);
  }
  private setupAudioEventListeners() {
    // p1 events
    this.player1.addEventListener('play', () => {
      this.updateState({
        player1: { ...this.state.player1, isPlaying: true }
      });
      this.playbackTracker.resumeTracking();
    });
    this.player1.addEventListener('pause', () => {
      this.updateState({
        player1: { ...this.state.player1, isPlaying: false }
      });
      this.playbackTracker.pauseTracking();
    });
    this.player1.addEventListener('timeupdate', () => {
      this.updateState({
        player1: { 
          ...this.state.player1, 
          currentTime: this.player1.currentTime,
          duration: this.player1.duration || 0
        }
      });
      this.playbackTracker.updateProgress(this.player1.currentTime, this.player1.duration);
    });
    this.player1.addEventListener('ended', () => {
      this.updateState({
        player1: { 
          ...this.state.player1, 
          isPlaying: false, 
          hasEnded: true 
        }
      });
    });
    // p2 events
    this.player2.addEventListener('play', () => {
      this.updateState({
        player2: { ...this.state.player2, isPlaying: true }
      });
    });
    this.player2.addEventListener('pause', () => {
      this.updateState({
        player2: { ...this.state.player2, isPlaying: false }
      });
    });
    this.player2.addEventListener('timeupdate', () => {
      this.updateState({
        player2: { 
          ...this.state.player2, 
          currentTime: this.player2.currentTime,
          duration: this.player2.duration || 0
        }
      });
    });
    this.player2.addEventListener('ended', () => {
      this.updateState({
        player2: { 
          ...this.state.player2, 
          isPlaying: false, 
          hasEnded: true 
        }
      });
    });
  }
  private updateState(newState: Partial<AudioState>) {
    this.state = { ...this.state, ...newState };
    this.onStateChange?.(this.state);
  }
  getState(): AudioState {
    return this.state;
  }
} 