import React from 'react';
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { OnboardingGate } from '../../components/OnboardingGate';
import { useAppStore } from '../../stores/appStore';
import { hasValidUsername, needsUsernameOnboarding } from '../../utils/onboarding';

const initialAppState = useAppStore.getState();

describe('onboarding helpers', () => {
  it('requires a valid username for authenticated users', () => {
    expect(needsUsernameOnboarding({ username: undefined })).toBe(true);
    expect(needsUsernameOnboarding({ username: 'ab' })).toBe(true);
    expect(needsUsernameOnboarding({ username: 'valid_name' })).toBe(false);
    expect(hasValidUsername({ username: 'BadName' })).toBe(false);
  });
});

describe('OnboardingGate', () => {
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

  it('redirects signed-in users without a valid username and preserves destination', async () => {
    await act(async () => {
      useAppStore.setState(state => ({
        ...state,
        auth: {
          ...state.auth,
          user: { uid: 'user-1', email: 'user@example.com' } as any,
          loading: false
        }
      }));
    });

    render(
      <MemoryRouter initialEntries={['/collab/collab-1?tab=votes']}>
        <Routes>
          <Route element={<OnboardingGate />}>
            <Route path="/collab/:collabId" element={<div>protected</div>} />
          </Route>
          <Route path="/onboarding/username" element={<div data-testid="onboarding">onboarding</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByTestId('onboarding')).toBeInTheDocument();
  });

  it('lets anonymous visitors through after auth state resolves', async () => {
    await act(async () => {
      useAppStore.setState(state => ({
        ...state,
        auth: {
          ...state.auth,
          user: null,
          loading: false
        }
      }));
    });

    render(
      <MemoryRouter initialEntries={['/collabs']}>
        <Routes>
          <Route element={<OnboardingGate />}>
            <Route path="/collabs" element={<div data-testid="collabs">collabs</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByTestId('collabs')).toBeInTheDocument();
  });
});
