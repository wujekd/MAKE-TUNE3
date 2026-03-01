import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useAppStore } from '../../stores/appStore';
import { useCollaborationLoader } from '../../hooks/useCollaborationLoader';

const initialAppState = useAppStore.getState();

describe('useCollaborationLoader', () => {
  beforeEach(() => {
    act(() => {
      useAppStore.setState(initialAppState, true);
    });
  });

  afterEach(() => {
    act(() => {
      useAppStore.setState(initialAppState, true);
    });
  });

  it('loads as authenticated when user is present', async () => {
    const loadCollaboration = vi.fn().mockResolvedValue(undefined);
    const loadCollaborationAnonymousById = vi.fn().mockResolvedValue(undefined);

    act(() => {
      useAppStore.setState(state => ({
        ...state,
        auth: {
          ...state.auth,
          user: { uid: 'user-1', email: 'user@example.com' } as any,
          loading: false
        },
        collaboration: {
          ...state.collaboration,
          loadCollaboration,
          loadCollaborationAnonymousById
        }
      }));
    });

    const { result } = renderHook(() => useCollaborationLoader('collab-1'));

    await waitFor(() => {
      expect(loadCollaboration).toHaveBeenCalledWith('user-1', 'collab-1');
    });
    expect(loadCollaborationAnonymousById).not.toHaveBeenCalled();

    await waitFor(() => {
      expect(result.current.status).toBe('idle');
    });
  });

  it('loads anonymously when no user is present', async () => {
    const loadCollaboration = vi.fn().mockResolvedValue(undefined);
    const loadCollaborationAnonymousById = vi.fn().mockResolvedValue(undefined);

    act(() => {
      useAppStore.setState(state => ({
        ...state,
        auth: {
          ...state.auth,
          user: null,
          loading: false
        },
        collaboration: {
          ...state.collaboration,
          loadCollaboration,
          loadCollaborationAnonymousById
        }
      }));
    });

    renderHook(() => useCollaborationLoader('collab-2'));

    await waitFor(() => {
      expect(loadCollaborationAnonymousById).toHaveBeenCalledWith('collab-2');
    });
    expect(loadCollaboration).not.toHaveBeenCalled();
  });
});
