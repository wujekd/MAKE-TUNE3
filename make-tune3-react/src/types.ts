// src/audio/types.ts

/**
 * Represents the playback state of an individual audio player.
 */
export interface PlayerState {
    /** Is the player currently playing? */
    isPlaying: boolean;
    /** Current playback time in seconds. */
    currentTime: number;
    /** Duration of the loaded audio in seconds. */
    duration: number;
    /** Gain (0.0 - 1.0) for this player. */
    volume: number;
    /** Source URL of the loaded audio, if any. */
    source: string | null;
    /** Has playback reached the end? */
    hasEnded: boolean;
    /** Any playback or loading error. */
    error: Error | null;
  }
  
  /**
   * Represents the master volume state.
   */
  export interface MasterState {
    /** Master gain (0.0 - 1.0). */
    volume: number;
  }
  
  /**
   * Combined audio engine state.
   */
  export interface AudioState {
    /** State for player 1. */
    player1: PlayerState;
    /** State for player 2. */
    player2: PlayerState;
    /** Master volume state. */
    master: MasterState;
  }
  