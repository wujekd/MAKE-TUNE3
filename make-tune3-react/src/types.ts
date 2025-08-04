export interface PlayerState {
    isPlaying: boolean;
    currentTime: number;
    duration: number;
    volume: number;
    source: string | null;
    hasEnded: boolean;
    error: Error | null;
  }
  
  export interface MasterState {
    volume: number;
  }

  export interface PlayerControllerState {
    pastStagePlayback: boolean;
    currentTrackId: number;
  }
  
  export interface AudioState {
    playerController: PlayerControllerState
    player1: PlayerState;
    player2: PlayerState;
    master: MasterState;
  }
  