import type { AudioState, EqState } from '../types.ts';
import { PlaybackTracker } from './playback-tracker.ts';

export class AudioEngine {
  private player1: HTMLAudioElement;
  private player2: HTMLAudioElement;
  private audioContext: AudioContext;
  private player1Source: MediaElementAudioSourceNode | null = null;
  private player2Source: MediaElementAudioSourceNode | null = null;
  private player1Gain: GainNode | null = null;
  private player2Gain: GainNode | null = null;
  private player1MuteGain: GainNode | null = null;
  private eq: {
    highpass: BiquadFilterNode | null;
    param1: BiquadFilterNode | null;
    param2: BiquadFilterNode | null;
    highshelf: BiquadFilterNode | null;
  } = { highpass: null, param1: null, param2: null, highshelf: null };
  private eqEnabled: boolean = true;
  // todo: add eq gains, solo, mute, mute master, stop playback tracker and emit state
  private masterGain: GainNode | null = null;
  private masterAnalyser: AnalyserNode | null = null;
  private masterMeterHpf: BiquadFilterNode | null = null; // HPF for metering (removes bass dominance)
  private player1Analyser: AnalyserNode | null = null;
  private player2Analyser: AnalyserNode | null = null;
  private levelListeners: Set<(level: { peak: number; rms: number }) => void> = new Set();
  private player1LevelListeners: Set<(level: { peak: number; rms: number }) => void> = new Set();
  private player2LevelListeners: Set<(level: { peak: number; rms: number }) => void> = new Set();
  private rafId: number | null = null;
  private syncRafId: number | null = null;
  private state: AudioState;
  private onStateChange?: (state: AudioState) => void;
  private playbackTracker: PlaybackTracker;
  private onTrackListened?: (trackSrc: string) => void;
  private listenedRatio?: number;
  private isTrackListened?: (trackSrc: string) => boolean;
  private playbackTrackingEnabled: boolean = true;

  constructor(player1: HTMLAudioElement, player2: HTMLAudioElement,) {
    this.player1 = player1;
    this.player2 = player2;
    // dont create right away, wait for user interaction - thanks chrome
    this.audioContext = null as any;
    this.state = {
      playerController: { playingFavourite: false, pastStagePlayback: false, currentTrackId: -1 },
      player1: { isPlaying: false, currentTime: 0, duration: 0, volume: 1, source: null, hasEnded: false, error: null },
      player2: { isPlaying: false, currentTime: 0, duration: 0, volume: 1, source: null, hasEnded: false, error: null },
      master: { volume: 1 },
      eq: {
        highpass: { frequency: 20, Q: 0.7 },
        param1: { frequency: 250, Q: 1, gain: 0 },
        param2: { frequency: 3000, Q: 1, gain: 0 },
        highshelf: { frequency: 8000, gain: 0 }
      }
    };
    this.setupAudioEventListeners();
    this.playbackTracker = new PlaybackTracker(
      (trackSrc) => this.onTrackListened?.(trackSrc)
    );
  }

  // audio init
  private initAudioContext(): AudioContext {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.setupAudioRouting();
      this.connectPlayerToAudioContext(1);
      this.connectPlayerToAudioContext(2);
      if (this.levelListeners.size > 0) {
        this.startLevelLoop();
      }
    }
    return this.audioContext;
  }

  private synchronizePlayers(windowMs: number = 3000, threshold: number = 0.001): void {
    const start = performance.now();
    const adjust = () => {
      const now = performance.now();
      if (now - start > windowMs) return;
      const d = this.player1.currentTime - this.player2.currentTime;
      if (Math.abs(d) > threshold) {
        if (d > 0) this.player2.currentTime = this.player1.currentTime;
        else this.player1.currentTime = this.player2.currentTime;
      }
      this.syncRafId = window.requestAnimationFrame(adjust);
    };
    if (this.syncRafId !== null) cancelAnimationFrame(this.syncRafId);
    this.syncRafId = window.requestAnimationFrame(adjust);
  }
  private setupAudioRouting(): void {
    if (!this.audioContext) return;

    this.player1Gain = this.audioContext.createGain();
    this.player2Gain = this.audioContext.createGain();
    this.player1MuteGain = this.audioContext.createGain();
    // eq filters for player1
    this.eq.highpass = this.audioContext.createBiquadFilter();
    this.eq.param1 = this.audioContext.createBiquadFilter();
    this.eq.param2 = this.audioContext.createBiquadFilter();
    this.eq.highshelf = this.audioContext.createBiquadFilter();

    this.masterGain = this.audioContext.createGain();

    // High-pass filter for metering - removes bass dominance so transients (snare, hats) can punch through
    this.masterMeterHpf = this.audioContext.createBiquadFilter();
    this.masterMeterHpf.type = 'highpass';
    this.masterMeterHpf.frequency.value = 200; // Cut below 200Hz for VU meter
    this.masterMeterHpf.Q.value = 0.7; // Gentle slope

    this.masterAnalyser = this.audioContext.createAnalyser();
    this.masterAnalyser.fftSize = 1024;
    this.masterAnalyser.smoothingTimeConstant = 0.8;

    // Create individual channel analysers
    this.player1Analyser = this.audioContext.createAnalyser();
    this.player1Analyser.fftSize = 512;
    this.player1Analyser.smoothingTimeConstant = 0.8;

    this.player2Analyser = this.audioContext.createAnalyser();
    this.player2Analyser.fftSize = 512;
    this.player2Analyser.smoothingTimeConstant = 0.8;

    // player1 chain: gain -> highpass -> param1 -> param2 -> highshelf -> mute -> master
    this.player1Gain.connect(this.eq.highpass);
    this.eq.highpass.connect(this.eq.param1);
    this.eq.param1.connect(this.eq.param2);
    this.eq.param2.connect(this.eq.highshelf);
    this.eq.highshelf.connect(this.player1MuteGain);
    // Tap player1 post-EQ for level monitoring
    this.player1MuteGain.connect(this.player1Analyser);
    this.player1MuteGain.connect(this.masterGain);
    // Tap player2 for level monitoring
    this.player2Gain.connect(this.player2Analyser);
    this.player2Gain.connect(this.masterGain);
    // split: to destination and to HPF'd analyser for metering
    this.masterGain.connect(this.audioContext.destination);
    // Meter chain: masterGain -> HPF -> analyser (so bass doesn't dominate the VU meter)
    this.masterGain.connect(this.masterMeterHpf);
    this.masterMeterHpf.connect(this.masterAnalyser);

    this.player1Gain.gain.value = this.state.player1.volume;
    this.player1MuteGain.gain.value = 1;
    if (this.eq.highpass) {
      this.eq.highpass.type = 'highpass';
      this.eq.highpass.frequency.value = this.state.eq.highpass.frequency;
      this.eq.highpass.Q.value = this.state.eq.highpass.Q;
    }
    if (this.eq.param1) {
      this.eq.param1.type = 'peaking';
      this.eq.param1.frequency.value = this.state.eq.param1.frequency;
      this.eq.param1.Q.value = this.state.eq.param1.Q;
      this.eq.param1.gain.value = this.state.eq.param1.gain;
    }
    if (this.eq.param2) {
      this.eq.param2.type = 'peaking';
      this.eq.param2.frequency.value = this.state.eq.param2.frequency;
      this.eq.param2.Q.value = this.state.eq.param2.Q;
      this.eq.param2.gain.value = this.state.eq.param2.gain;
    }
    if (this.eq.highshelf) {
      this.eq.highshelf.type = 'highshelf';
      this.eq.highshelf.frequency.value = this.state.eq.highshelf.frequency;
      this.eq.highshelf.gain.value = this.state.eq.highshelf.gain;
    }
    this.player2Gain.gain.value = this.state.player2.volume;
    this.masterGain.gain.value = this.state.master.volume;
  }

  private async resumeIfSuspended(): Promise<void> {
    if (!this.audioContext) return;
    if (this.audioContext.state !== 'running') {
      try { await this.audioContext.resume(); } catch { }
    }
  }

  async unlock(): Promise<void> {
    this.initAudioContext();
    await this.resumeIfSuspended();
  }

  private wireEq(enabled: boolean): void {
    if (!this.audioContext || !this.player1Gain || !this.player1MuteGain) return;
    try {
      this.player1Gain.disconnect();
    } catch { }
    if (enabled) {
      if (this.eq.highpass) {
        this.player1Gain.connect(this.eq.highpass);
      }
    } else {
      this.player1Gain.connect(this.player1MuteGain);
    }
    this.eqEnabled = enabled;
  }
  private startLevelLoop() {
    if (!this.audioContext || !this.masterAnalyser || !this.player1Analyser || !this.player2Analyser) return;
    if (this.rafId !== null) return;

    const masterAnalyser = this.masterAnalyser;
    const player1Analyser = this.player1Analyser;
    const player2Analyser = this.player2Analyser;

    const masterBuffer = new Float32Array(masterAnalyser.fftSize);
    const player1Buffer = new Float32Array(player1Analyser.fftSize);
    const player2Buffer = new Float32Array(player2Analyser.fftSize);

    const notify = () => {
      // Master level
      masterAnalyser.getFloatTimeDomainData(masterBuffer);
      let peak = 0;
      let sum = 0;
      for (let i = 0; i < masterBuffer.length; i++) {
        const v = masterBuffer[i];
        const av = Math.abs(v);
        if (av > peak) peak = av;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / masterBuffer.length);
      this.levelListeners.forEach(cb => cb({ peak, rms }));

      // Player1 level
      player1Analyser.getFloatTimeDomainData(player1Buffer);
      let peak1 = 0;
      let sum1 = 0;
      for (let i = 0; i < player1Buffer.length; i++) {
        const v = player1Buffer[i];
        const av = Math.abs(v);
        if (av > peak1) peak1 = av;
        sum1 += v * v;
      }
      const rms1 = Math.sqrt(sum1 / player1Buffer.length);
      this.player1LevelListeners.forEach(cb => cb({ peak: peak1, rms: rms1 }));

      // Player2 level
      player2Analyser.getFloatTimeDomainData(player2Buffer);
      let peak2 = 0;
      let sum2 = 0;
      for (let i = 0; i < player2Buffer.length; i++) {
        const v = player2Buffer[i];
        const av = Math.abs(v);
        if (av > peak2) peak2 = av;
        sum2 += v * v;
      }
      const rms2 = Math.sqrt(sum2 / player2Buffer.length);
      this.player2LevelListeners.forEach(cb => cb({ peak: peak2, rms: rms2 }));

      this.rafId = window.requestAnimationFrame(notify);
    };
    this.rafId = window.requestAnimationFrame(notify);
  }
  private stopLevelLoopIfIdle() {
    if (this.levelListeners.size === 0 &&
      this.player1LevelListeners.size === 0 &&
      this.player2LevelListeners.size === 0 &&
      this.rafId !== null) {
      window.cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }
  onMasterLevel(callback: (level: { peak: number; rms: number }) => void): () => void {
    this.levelListeners.add(callback);
    this.startLevelLoop();
    return () => {
      this.levelListeners.delete(callback);
      this.stopLevelLoopIfIdle();
    };
  }
  onPlayer1Level(callback: (level: { peak: number; rms: number }) => void): () => void {
    this.player1LevelListeners.add(callback);
    this.startLevelLoop();
    return () => {
      this.player1LevelListeners.delete(callback);
      this.stopLevelLoopIfIdle();
    };
  }
  onPlayer2Level(callback: (level: { peak: number; rms: number }) => void): () => void {
    this.player2LevelListeners.add(callback);
    this.startLevelLoop();
    return () => {
      this.player2LevelListeners.delete(callback);
      this.stopLevelLoopIfIdle();
    };
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
  // playback methods
  private async ensureLoaded(player: HTMLAudioElement, src: string, timeoutMs: number = 500): Promise<void> {
    if (!src) return;
    if (player.src !== src) {
      player.src = src;
      player.load();
    }
    if (player.readyState >= 2) return;
    const ready = new Promise<void>((resolve, reject) => {
      const onReady = () => { cleanup(); resolve(); };
      const onErr = () => { cleanup(); reject(new Error('audio load error')); };
      const cleanup = () => {
        player.removeEventListener('canplay', onReady);
        player.removeEventListener('error', onErr);
      };
      player.addEventListener('canplay', onReady, { once: true });
      player.addEventListener('error', onErr, { once: true });
    });
    const timed = new Promise<void>((resolve) => setTimeout(resolve, timeoutMs));
    await Promise.race([ready, timed]).catch(() => { });
  }
  loadSource(playerId: 1 | 2, src: string): void {
    const player = playerId === 1 ? this.player1 : this.player2;
    if (player.src === src) {
      return;
    }
    player.src = src;
    player.load();
    if (playerId === 1) {
      this.player2.currentTime = 0;
    }
    this.updateState({
      [`player${playerId}`]: {
        ...this.state[`player${playerId}`],
        source: src,
        isPlaying: false,
        hasEnded: false,
        currentTime: 0
      },
      ...(playerId === 1 && {
        player2: {
          ...this.state.player2,
          currentTime: 0
        }
      })
    });
  }
  async playSubmission(submissionSrc: string, backingSrc: string, index: number): Promise<void> {
    this.initAudioContext();
    this.resumeIfSuspended();
    this.loadSource(1, submissionSrc);
    this.loadSource(2, backingSrc);
    await this.ensureLoaded(this.player1, submissionSrc);
    await this.ensureLoaded(this.player2, backingSrc, 120);
    this.player1.currentTime = 0;
    this.player2.currentTime = 0;
    this.state.playerController.pastStagePlayback = false;
    this.state.playerController.currentTrackId = index;
    this.updateState({
      player1: { ...this.state.player1, isPlaying: true },
      player2: { ...this.state.player2, isPlaying: true }
    });
    if (this.playbackTrackingEnabled && this.onTrackListened && this.isTrackListened && !this.isTrackListened(submissionSrc)) {
      console.log(`AudioEngine: Starting playback tracking for ${submissionSrc} (not yet listened)`);
      this.playbackTracker.startTracking(submissionSrc);
    } else {
      console.log(`AudioEngine: Skipping playback tracking for ${submissionSrc} (already listened or tracking disabled)`);
    }
    this.player1.playbackRate = 1;
    this.player2.playbackRate = 1;
    this.player2.muted = false;
    this.resumeIfSuspended();
    try { await this.player2.play(); } catch { }
    try {
      await this.player1.play();
    } catch { }
    if (this.player2.paused) {
      try { await this.resumeIfSuspended(); await this.player2.play(); } catch { }
    }
    {
      const t = Math.max(this.player1.currentTime, this.player2.currentTime);
      this.player1.currentTime = t;
      this.player2.currentTime = t;
    }
    this.synchronizePlayers(1500, 0.005);
  }
  async playPastStage(submissionSrc: string, backingSrc: string, index: number): Promise<void> {
    this.initAudioContext();
    await this.resumeIfSuspended();
    this.loadSource(1, submissionSrc);
    this.loadSource(2, backingSrc);
    await this.ensureLoaded(this.player1, submissionSrc);
    await this.ensureLoaded(this.player2, backingSrc);
    this.player1.currentTime = 0;
    this.player2.currentTime = 0;
    this.state.playerController.pastStagePlayback = true;
    this.state.playerController.playingFavourite = false;
    this.state.playerController.currentTrackId = index;
    this.player1.playbackRate = 1;
    this.player2.playbackRate = 1;
    await Promise.all([
      this.player1.play(),
      this.player2.play()
    ]);
    this.updateState({
      player1: { ...this.state.player1, isPlaying: true },
      player2: { ...this.state.player2, isPlaying: true }
    });
  }

  async playBackingOnly(src: string): Promise<void> {
    if (!src) return;
    this.initAudioContext();
    await this.resumeIfSuspended();
    this.loadSource(2, src);
    await this.ensureLoaded(this.player2, src);
    this.player1.pause();
    this.player2.currentTime = 0;
    this.player2.playbackRate = 1;
    try { await this.player2.play(); } catch { }
    this.state.playerController.pastStagePlayback = true;
    this.state.playerController.playingFavourite = false;
    this.state.playerController.currentTrackId = -1;
    this.updateState({
      player1: { ...this.state.player1, isPlaying: false },
      player2: { ...this.state.player2, isPlaying: true },
      playerController: { ...this.state.playerController }
    });
  }

  stopBackingPlayback(resetTime: boolean = true): void {
    this.player2.pause();
    if (resetTime) {
      this.player2.currentTime = 0;
    }
    this.state.playerController.pastStagePlayback = false;
    this.state.playerController.playingFavourite = false;
    this.state.playerController.currentTrackId = -1;
    this.updateState({
      player2: {
        ...this.state.player2,
        isPlaying: false,
        currentTime: resetTime ? 0 : this.player2.currentTime
      },
      playerController: { ...this.state.playerController }
    });
  }

  // preview submission with backing without altering track index or listened tracking
  async previewSubmission(submissionSrc: string, backingSrc: string): Promise<void> {
    this.initAudioContext();
    this.resumeIfSuspended();
    if (this.state.player2.source !== backingSrc) this.loadSource(2, backingSrc);
    this.loadSource(1, submissionSrc);
    await this.ensureLoaded(this.player1, submissionSrc);
    await this.ensureLoaded(this.player2, backingSrc, 120);
    this.state.playerController.pastStagePlayback = false;
    this.updateState({
      player1: { ...this.state.player1, isPlaying: true },
      player2: { ...this.state.player2, isPlaying: true }
    });
    this.player1.playbackRate = 1;
    this.player2.playbackRate = 1;
    this.player2.muted = false;
    this.resumeIfSuspended();
    try { await this.player2.play(); } catch { }
    try {
      await this.player1.play();
    } catch { }
    if (this.player2.paused) {
      try { await this.resumeIfSuspended(); await this.player2.play(); } catch { }
    }
    {
      const t = Math.max(this.player1.currentTime, this.player2.currentTime);
      this.player1.currentTime = t;
      this.player2.currentTime = t;
    }
    this.synchronizePlayers(1500, 0.005);
  }

  async preloadBacking(src: string): Promise<void> {
    if (!src) return;
    this.initAudioContext();
    await this.resumeIfSuspended();
    if (this.state.player2.source !== src) this.loadSource(2, src);
    await this.ensureLoaded(this.player2, src);
    const wasMuted = this.player2.muted;
    try {
      this.player2.muted = true;
      await this.player2.play();
    } catch {
      // ignore autoplay failures; ensureLoaded already primed buffer
    } finally {
      try { this.player2.pause(); } catch { }
      this.player2.currentTime = 0;
      this.player2.muted = wasMuted;
    }
  }

  stopPreview(): void {
    this.player1.pause();
    this.player2.pause();
    this.updateState({
      player1: { ...this.state.player1, isPlaying: false },
      player2: { ...this.state.player2, isPlaying: false }
    });
  }
  pause(): void {
    this.player1.pause();
    this.player2.pause();
    this.updateState({
      player1: { ...this.state.player1, isPlaying: false },
      player2: { ...this.state.player2, isPlaying: false } // is this a better syntax?
    });
    this.playbackTracker.pauseTracking();
  }
  stop(playerId: 1 | 2): void {
    const player = playerId === 1 ? this.player1 : this.player2;
    player.pause();
    player.currentTime = 0;
  }
  togglePlayback(): void {
    this.toggleBoth();
  }
  toggleP2(): void {
    this.initAudioContext();
    this.resumeIfSuspended();
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
    this.resumeIfSuspended();
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

  setSubmissionMuted(muted: boolean): void {
    this.initAudioContext();
    if (this.player1MuteGain) {
      this.player1MuteGain.gain.value = muted ? 0 : 1;
    }
  }

  setEq(params: Partial<EqState>): void {
    this.initAudioContext();
    const next: EqState = {
      ...this.state.eq,
      ...params,
      highpass: { ...(params.highpass ?? this.state.eq.highpass) },
      param1: { ...(params.param1 ?? this.state.eq.param1) },
      param2: { ...(params.param2 ?? this.state.eq.param2) },
      highshelf: { ...(params.highshelf ?? this.state.eq.highshelf) }
    };
    this.updateState({ eq: next as any });
    if (this.eq.highpass && params.highpass) {
      this.eq.highpass.frequency.value = next.highpass.frequency;
      this.eq.highpass.Q.value = next.highpass.Q;
    }
    if (this.eq.param1 && params.param1) {
      this.eq.param1.frequency.value = next.param1.frequency;
      this.eq.param1.Q.value = next.param1.Q;
      this.eq.param1.gain.value = next.param1.gain;
    }
    if (this.eq.param2 && params.param2) {
      this.eq.param2.frequency.value = next.param2.frequency;
      this.eq.param2.Q.value = next.param2.Q;
      this.eq.param2.gain.value = next.param2.gain;
    }
    if (this.eq.highshelf && params.highshelf) {
      this.eq.highshelf.frequency.value = next.highshelf.frequency;
      this.eq.highshelf.gain.value = next.highshelf.gain;
    }
  }

  setEqEnabled(enabled: boolean): void {
    this.initAudioContext();
    this.wireEq(enabled);
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
    console.log('setPlayingFavourite called with:', value);
    this.updateState({
      playerController: {
        ...this.state.playerController,
        playingFavourite: value
      }
    });
  }
  updateCurrentTrackId(trackId: number): void {
    this.updateState({
      playerController: {
        ...this.state.playerController,
        currentTrackId: trackId
      }
    });
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
  seekBacking(time: number): void {
    // Seek only player2 (backing track) - used when no submission is loaded
    this.player2.currentTime = time;
    this.updateState({
      player2: {
        ...this.state.player2,
        currentTime: time
      }
    });
  }
  resetPlayback(): void {
    // Stop and reset both players without clearing the loaded sources (cache)
    this.player1.pause();
    this.player2.pause();
    this.player1.currentTime = 0;
    this.player2.currentTime = 0;

    // Reset controller state
    this.state.playerController.pastStagePlayback = false;
    this.state.playerController.playingFavourite = false;
    this.state.playerController.currentTrackId = -1;

    // Stop playback tracking
    this.playbackTracker.stopTracking();

    // Update state - preserves source so audio cache remains intact
    this.updateState({
      player1: {
        ...this.state.player1,
        isPlaying: false,
        currentTime: 0,
        hasEnded: false
      },
      player2: {
        ...this.state.player2,
        isPlaying: false,
        currentTime: 0,
        hasEnded: false
      },
      playerController: { ...this.state.playerController }
    });
  }
  // state methods
  setCallbacks(onStateChange: (state: AudioState) => void) {
    this.onStateChange = onStateChange;
  }
  setTrackListenedCallback(callback: (trackSrc: string) => void, listenedRatio: number, isTrackListened?: (trackSrc: string) => boolean): void {
    this.onTrackListened = callback;
    this.isTrackListened = isTrackListened;
    if (this.listenedRatio !== listenedRatio) {
      this.listenedRatio = listenedRatio;
      this.playbackTracker.setListenRatio(listenedRatio);
    }
  }
  clearTrackListenedCallback(): void {
    this.onTrackListened = undefined;
    this.isTrackListened = undefined;
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
      if (this.playbackTrackingEnabled) {
        this.playbackTracker.updateProgress(this.player1.currentTime, this.player1.duration);
      }
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
  setPlaybackTrackingEnabled(enabled: boolean): void {
    this.playbackTrackingEnabled = enabled;
    if (!enabled) {
      this.playbackTracker.stopTracking();
    }
  }
  private updateState(newState: Partial<AudioState>) {
    this.state = { ...this.state, ...newState };
    this.onStateChange?.(this.state);
  }
  getState(): AudioState {
    return this.state;
  }
}
