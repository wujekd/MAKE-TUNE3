import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { useAppStore } from '../../stores/appStore';
import { useUIStore } from '../../stores/useUIStore';
import { AuthRoute } from '../../components/AuthRoute';

const mockNavigate = vi.fn();
let searchParams = new URLSearchParams();

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useSearchParams: () => [searchParams, vi.fn()]
  };
});

vi.mock('../../views/auth/AuthView', () => ({
  AuthView: ({ initialMode }: { initialMode: string }) => (
    <div data-testid="auth-view">{initialMode}</div>
  )
}));

const initialAppState = useAppStore.getState();
const initialUIState = useUIStore.getState();

describe('AuthRoute', () => {
  beforeEach(async () => {
    mockNavigate.mockReset();
    searchParams = new URLSearchParams();
    await act(async () => {
      useAppStore.setState(initialAppState, true);
      useUIStore.setState(initialUIState, true);
    });
  });

  afterEach(async () => {
    await act(async () => {
      useAppStore.setState(initialAppState, true);
      useUIStore.setState(initialUIState, true);
    });
  });

  it('redirects authenticated users with usernames to the dashboard', async () => {
    await act(async () => {
      useAppStore.setState(state => ({
        ...state,
        auth: {
          ...state.auth,
          user: { uid: 'user-1', email: 'user@example.com', username: 'demo' } as any,
          loading: false
        }
      }));
    });

    render(<AuthRoute />);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/collabs', { replace: true });
    });

    expect(screen.getByTestId('auth-view')).toBeInTheDocument();
  });

  it('redirects authenticated users without usernames to onboarding', async () => {
    await act(async () => {
      useAppStore.setState(state => ({
        ...state,
        auth: {
          ...state.auth,
          user: { uid: 'user-2', email: 'user@example.com' } as any,
          loading: false
        }
      }));
    });

    render(<AuthRoute />);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/onboarding/username', { replace: true });
    });

    expect(screen.getByTestId('auth-view')).toBeInTheDocument();
  });
});
