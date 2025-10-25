import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAudioStore } from '../../stores/useAudioStore';

describe('useAudioStore', () => {
  beforeEach(() => {
    useAudioStore.setState({
      engine: null,
      state: null
    });
  });

  it('should initialize with null engine and state', () => {
    const state = useAudioStore.getState();
    
    expect(state.engine).toBeNull();
    expect(state.state).toBeNull();
  });

  it('should set audio engine', () => {
    const { setEngine } = useAudioStore.getState();
    const mockEngine = { 
      play: vi.fn(),
      pause: vi.fn(),
      setVolume: vi.fn()
    } as any;
    
    setEngine(mockEngine);
    
    expect(useAudioStore.getState().engine).toBe(mockEngine);
  });

  it('should set audio state', () => {
    const { setState } = useAudioStore.getState();
    const mockState = { 
      playing: true,
      currentTime: 10,
      duration: 100,
      player1: { volume: 0.8 },
      player2: { volume: 0.6 }
    } as any;
    
    setState(mockState);
    
    expect(useAudioStore.getState().state).toBe(mockState);
  });

  it('should update engine and state independently', () => {
    const { setEngine, setState } = useAudioStore.getState();
    const mockEngine = { play: vi.fn() } as any;
    const mockState = { playing: false } as any;
    
    setEngine(mockEngine);
    expect(useAudioStore.getState().engine).toBe(mockEngine);
    expect(useAudioStore.getState().state).toBeNull();
    
    setState(mockState);
    expect(useAudioStore.getState().engine).toBe(mockEngine);
    expect(useAudioStore.getState().state).toBe(mockState);
  });
});

