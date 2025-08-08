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

export interface EqBandHP {
  frequency: number;
  Q: number;
}
export interface EqBandParam {
  frequency: number;
  Q: number;
  gain: number;
}
export interface EqBandShelf {
  frequency: number;
  gain: number;
}
export interface EqState {
  highpass: EqBandHP;
  param1: EqBandParam;
  param2: EqBandParam;
  highshelf: EqBandShelf;
}

  export interface PlayerControllerState {
    pastStagePlayback: boolean;
    playingFavourite: boolean;
    currentTrackId: number;
  }
  
  export interface AudioState {
    playerController: PlayerControllerState
    player1: PlayerState;
    player2: PlayerState;
    master: MasterState;
  eq: EqState;
  }
  