import { describe, it, expect, beforeEach } from 'vitest';
import { useUIStore } from '../../stores/useUIStore';

describe('useUIStore', () => {
  beforeEach(() => {
    useUIStore.setState({
      isLoading: false,
      showAuth: false,
      debug: false
    });
  });

  it('should initialize with default state', () => {
    const state = useUIStore.getState();
    
    expect(state.isLoading).toBe(false);
    expect(state.showAuth).toBe(false);
    expect(state.debug).toBe(false);
  });

  it('should update loading state', () => {
    const { setLoading } = useUIStore.getState();
    
    setLoading(true);
    expect(useUIStore.getState().isLoading).toBe(true);
    
    setLoading(false);
    expect(useUIStore.getState().isLoading).toBe(false);
  });

  it('should toggle showAuth', () => {
    const { setShowAuth } = useUIStore.getState();
    
    setShowAuth(true);
    expect(useUIStore.getState().showAuth).toBe(true);
    
    setShowAuth(false);
    expect(useUIStore.getState().showAuth).toBe(false);
  });

  it('should toggle debug mode', () => {
    const { setDebug } = useUIStore.getState();
    
    setDebug(true);
    expect(useUIStore.getState().debug).toBe(true);
    
    setDebug(false);
    expect(useUIStore.getState().debug).toBe(false);
  });
});

