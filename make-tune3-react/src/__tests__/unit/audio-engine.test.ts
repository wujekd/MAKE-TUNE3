import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AudioEngine } from '../../audio-services/audio-engine';

// Mock HTML Audio Elements
const createMockAudioElement = () => ({
  src: '',
  currentTime: 0,
  duration: 0,
  volume: 1,
  paused: true,
  play: vi.fn().mockResolvedValue(undefined),
  pause: vi.fn(),
  load: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn()
});

describe('AudioEngine', () => {
  let audioEngine: AudioEngine;
  let mockPlayer1: ReturnType<typeof createMockAudioElement>;
  let mockPlayer2: ReturnType<typeof createMockAudioElement>;

  beforeEach(() => {
    // Create fresh mock audio elements for each test
    mockPlayer1 = createMockAudioElement();
    mockPlayer2 = createMockAudioElement();
    
    // Create AudioEngine instance
    audioEngine = new AudioEngine(
      mockPlayer1 as unknown as HTMLAudioElement,
      mockPlayer2 as unknown as HTMLAudioElement
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initialization', () => {
    it('should initialize with two audio elements', () => {
      expect(audioEngine).toBeDefined();
      expect(audioEngine.getState()).toBeDefined();
    });

    it('should have initial state with default values', () => {
      const state = audioEngine.getState();
      
      expect(state.player1.isPlaying).toBe(false);
      expect(state.player1.currentTime).toBe(0);
      expect(state.player1.duration).toBe(0);
      expect(state.player1.volume).toBe(1);
      expect(state.player1.source).toBe(null);
      
      expect(state.player2.isPlaying).toBe(false);
      expect(state.player2.currentTime).toBe(0);
      expect(state.player2.duration).toBe(0);
      expect(state.player2.volume).toBe(1);
      expect(state.player2.source).toBe(null);
      
      expect(state.master.volume).toBe(1);
    });
  });

  describe('loadSource', () => {
    it('should load source for player 1', () => {
      const testSrc = '/test-audio/sample.mp3';
      
      audioEngine.loadSource(1, testSrc);
      
      expect(mockPlayer1.src).toBe(testSrc);
      expect(mockPlayer1.load).toHaveBeenCalled();
    });

    it('should load source for player 2', () => {
      const testSrc = '/test-audio/backing.mp3';
      
      audioEngine.loadSource(2, testSrc);
      
      expect(mockPlayer2.src).toBe(testSrc);
      expect(mockPlayer2.load).toHaveBeenCalled();
    });

    it('should update state source property', () => {
      const testSrc = '/test-audio/sample.mp3';
      
      audioEngine.loadSource(1, testSrc);
      
      const state = audioEngine.getState();
      expect(state.player1.source).toBe(testSrc);
    });

    it('should reset player2 currentTime when loading player1', () => {
      mockPlayer2.currentTime = 10; // Set some initial time
      
      audioEngine.loadSource(1, '/test-audio/sample.mp3');
      
      expect(mockPlayer2.currentTime).toBe(0);
    });
  });

  describe('playSubmission', () => {
    it('should load both sources and start playback', async () => {
      const submissionSrc = '/test-audio/submission.mp3';
      const backingSrc = '/test-audio/backing.mp3';
      
      await audioEngine.playSubmission(submissionSrc, backingSrc, 0);
      
      expect(mockPlayer1.src).toBe(submissionSrc);
      expect(mockPlayer2.src).toBe(backingSrc);
      expect(mockPlayer1.play).toHaveBeenCalled();
      expect(mockPlayer2.play).toHaveBeenCalled();
    });

    it('should update state to playing', async () => {
      await audioEngine.playSubmission('/test-audio/submission.mp3', '/test-audio/backing.mp3', 0);
      
      const state = audioEngine.getState();
      expect(state.player1.isPlaying).toBe(true);
      expect(state.player2.isPlaying).toBe(true);
    });
  });

  describe('playPastStage', () => {
    it('should load both submission and backing sources and start playback', async () => {
      const submissionSrc = '/test-audio/winner-submission.mp3';
      const backingSrc = '/test-audio/past-backing.mp3';
      
      await audioEngine.playPastStage(submissionSrc, backingSrc, 0);
      
      expect(mockPlayer1.src).toBe(submissionSrc);
      expect(mockPlayer2.src).toBe(backingSrc);
      expect(mockPlayer1.play).toHaveBeenCalled();
      expect(mockPlayer2.play).toHaveBeenCalled();
    });

    it('should update both players state to playing', async () => {
      await audioEngine.playPastStage('/test-audio/winner.mp3', '/test-audio/backing.mp3', 0);
      
      const state = audioEngine.getState();
      expect(state.player1.isPlaying).toBe(true);
      expect(state.player2.isPlaying).toBe(true);
    });

    it('should set pastStagePlayback flag to true', async () => {
      await audioEngine.playPastStage('/test-audio/winner.mp3', '/test-audio/backing.mp3', 0);
      
      const state = audioEngine.getState();
      expect(state.playerController.pastStagePlayback).toBe(true);
    });

    it('should set currentTrackId to provided index', async () => {
      const trackIndex = 3;
      await audioEngine.playPastStage('/test-audio/winner.mp3', '/test-audio/backing.mp3', trackIndex);
      
      const state = audioEngine.getState();
      expect(state.playerController.currentTrackId).toBe(trackIndex);
    });
  });

  describe('pause', () => {
    it('should pause both players', () => {
      // First start playing
      audioEngine.playSubmission('/test-audio/submission.mp3', '/test-audio/backing.mp3', 0);
      
      // Then pause
      audioEngine.pause();
      
      expect(mockPlayer1.pause).toHaveBeenCalled();
      expect(mockPlayer2.pause).toHaveBeenCalled();
    });

    it('should update state to not playing', () => {
      // First start playing
      audioEngine.playSubmission('/test-audio/submission.mp3', '/test-audio/backing.mp3', 0);
      
      // Then pause
      audioEngine.pause();
      
      const state = audioEngine.getState();
      expect(state.player1.isPlaying).toBe(false);
      expect(state.player2.isPlaying).toBe(false);
    });
  });

  describe('volume control', () => {
    it('should set volume for player 1', () => {
      audioEngine.setVolume(1, 0.5);
      
      const state = audioEngine.getState();
      expect(state.player1.volume).toBe(0.5);
    });

    it('should set volume for player 2', () => {
      audioEngine.setVolume(2, 0.7);
      
      const state = audioEngine.getState();
      expect(state.player2.volume).toBe(0.7);
    });

    it('should set master volume', () => {
      audioEngine.setMasterVolume(0.8);
      
      const state = audioEngine.getState();
      expect(state.master.volume).toBe(0.8);
    });
  });

  describe('state callbacks', () => {
    it('should call state change callback when state updates', () => {
      const mockCallback = vi.fn();
      
      audioEngine.setCallbacks(mockCallback);
      
      // Trigger a state change
      audioEngine.setVolume(1, 0.5);
      
      expect(mockCallback).toHaveBeenCalled();
      expect(mockCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          player1: expect.objectContaining({ volume: 0.5 })
        })
      );
    });
  });
});