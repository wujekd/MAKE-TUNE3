import React, { Suspense } from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App, { createProjectRouteActions, VotingRoute } from '../../App';
import { ProjectService } from '../../services';
import { useAppStore } from '../../stores/appStore';

const routerProviderMounts = vi.hoisted(() => ({ count: 0 }));
const createBrowserRouterMock = vi.hoisted(() => vi.fn((routes: unknown) => ({ routes })));

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  const ReactModule = await import('react');

  function MockRouterProvider({ router }: { router: unknown }) {
    ReactModule.useEffect(() => {
      routerProviderMounts.count += 1;
    }, []);

    return ReactModule.createElement('div', {
      'data-router': String(Boolean(router)),
      'data-testid': 'router-provider'
    });
  }

  return {
    ...actual,
    createBrowserRouter: createBrowserRouterMock,
    RouterProvider: MockRouterProvider
  };
});

const votingViewLifecycle = vi.hoisted(() => ({
  mountCount: 0,
  unmountCount: 0,
  nextInstanceId: 0
}));

vi.mock('../../views/VotingView', async () => {
  const ReactModule = await import('react');

  function MockVotingView() {
    const instanceId = ReactModule.useRef<number | null>(null);

    if (instanceId.current === null) {
      instanceId.current = ++votingViewLifecycle.nextInstanceId;
    }

    ReactModule.useEffect(() => {
      votingViewLifecycle.mountCount += 1;
      return () => {
        votingViewLifecycle.unmountCount += 1;
      };
    }, []);

    return ReactModule.createElement('div', {
      'data-testid': 'voting-view',
      'data-instance-id': String(instanceId.current)
    });
  }

  return { VotingView: MockVotingView };
});

vi.mock('../../services', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services')>();
  return {
    ...actual,
    ProjectService: {
      ...actual.ProjectService,
      deleteProject: vi.fn(),
      listUserProjects: vi.fn()
    }
  };
});

const initialAppState = useAppStore.getState();

function setAuthUser(user: any) {
  useAppStore.setState(state => ({
    ...state,
    auth: {
      ...state.auth,
      user,
      loading: false
    }
  }));
}

describe('App routing', () => {
  beforeEach(() => {
    vi.mocked(ProjectService.deleteProject).mockReset();
    vi.mocked(ProjectService.listUserProjects).mockReset();
    routerProviderMounts.count = 0;
    votingViewLifecycle.mountCount = 0;
    votingViewLifecycle.unmountCount = 0;
    votingViewLifecycle.nextInstanceId = 0;
    act(() => {
      useAppStore.setState(initialAppState, true);
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    act(() => {
      useAppStore.setState(initialAppState, true);
    });
  });

  it('does not recreate the browser router when auth identity changes', async () => {
    render(<App />);

    expect(screen.getByTestId('router-provider')).toBeInTheDocument();
    expect(createBrowserRouterMock).toHaveBeenCalledTimes(1);
    expect(routerProviderMounts.count).toBe(1);

    await act(async () => {
      setAuthUser({ uid: 'user-1', email: 'one@example.com', username: 'one' });
    });

    await act(async () => {
      setAuthUser({ uid: 'user-2', email: 'two@example.com', username: 'two' });
    });

    await act(async () => {
      setAuthUser(null);
    });

    expect(createBrowserRouterMock).toHaveBeenCalledTimes(1);
    expect(routerProviderMounts.count).toBe(1);
  });

  it('keeps the voting view remount behavior when the auth user id changes', async () => {
    const { rerender } = render(
      <Suspense fallback={<div>loading</div>}>
        <VotingRoute />
      </Suspense>
    );

    const anonymousView = await screen.findByTestId('voting-view');
    expect(anonymousView).toHaveAttribute('data-instance-id', '1');
    expect(votingViewLifecycle.mountCount).toBe(1);

    await act(async () => {
      setAuthUser({ uid: 'user-1', email: 'one@example.com', username: 'one' });
    });
    rerender(
      <Suspense fallback={<div>loading</div>}>
        <VotingRoute />
      </Suspense>
    );

    await waitFor(() => {
      expect(screen.getByTestId('voting-view')).toHaveAttribute('data-instance-id', '2');
    });
    expect(votingViewLifecycle.mountCount).toBe(2);
    expect(votingViewLifecycle.unmountCount).toBe(1);

    await act(async () => {
      setAuthUser({ uid: 'user-2', email: 'two@example.com', username: 'two' });
    });
    rerender(
      <Suspense fallback={<div>loading</div>}>
        <VotingRoute />
      </Suspense>
    );

    await waitFor(() => {
      expect(screen.getByTestId('voting-view')).toHaveAttribute('data-instance-id', '3');
    });
    expect(votingViewLifecycle.mountCount).toBe(3);
    expect(votingViewLifecycle.unmountCount).toBe(2);
  });
});

describe('project delete route action', () => {
  const project = {
    id: 'project-1',
    ownerId: 'current-owner'
  };

  beforeEach(() => {
    vi.mocked(ProjectService.deleteProject).mockReset();
    vi.mocked(ProjectService.listUserProjects).mockReset();
    vi.stubGlobal('confirm', vi.fn(() => true));
    vi.stubGlobal('alert', vi.fn());
    act(() => {
      useAppStore.setState(initialAppState, true);
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    act(() => {
      useAppStore.setState(initialAppState, true);
    });
  });

  it('uses the latest current user from the store when deleting a project', async () => {
    const navigate = vi.fn();
    vi.mocked(ProjectService.deleteProject).mockResolvedValue(undefined);
    vi.mocked(ProjectService.listUserProjects).mockResolvedValue([{ id: 'remaining-1' }, { id: 'remaining-2' }] as any);

    act(() => {
      setAuthUser({ uid: 'stale-owner', email: 'stale@example.com', username: 'stale', projectCount: 9 });
    });
    const deleteAction = createProjectRouteActions({ navigate, project }).find((action: any) => action.key === 'delete');
    expect(deleteAction).toBeDefined();

    act(() => {
      setAuthUser({ uid: 'current-owner', email: 'current@example.com', username: 'current', projectCount: 9 });
    });

    await deleteAction!.onClick();

    expect(ProjectService.deleteProject).toHaveBeenCalledWith('project-1');
    expect(ProjectService.listUserProjects).toHaveBeenCalledWith('current-owner');
    expect(useAppStore.getState().auth.user?.projectCount).toBe(2);
    expect(navigate).toHaveBeenCalledWith('/collabs');
  });

  it('refreshes project count only when the deleted project belongs to the current user', async () => {
    const navigate = vi.fn();
    vi.mocked(ProjectService.deleteProject).mockResolvedValue(undefined);
    vi.mocked(ProjectService.listUserProjects).mockResolvedValue([{ id: 'remaining-1' }] as any);

    act(() => {
      setAuthUser({ uid: 'different-user', email: 'other@example.com', username: 'other', projectCount: 4 });
    });

    const deleteAction = createProjectRouteActions({ navigate, project }).find((action: any) => action.key === 'delete');
    expect(deleteAction).toBeDefined();
    await deleteAction!.onClick();

    expect(ProjectService.deleteProject).toHaveBeenCalledWith('project-1');
    expect(ProjectService.listUserProjects).not.toHaveBeenCalled();
    expect(useAppStore.getState().auth.user?.projectCount).toBe(4);
    expect(navigate).toHaveBeenCalledWith('/collabs');
  });

  it('alerts when project deletion fails', async () => {
    const navigate = vi.fn();
    vi.mocked(ProjectService.deleteProject).mockRejectedValue(new Error('boom'));

    act(() => {
      setAuthUser({ uid: 'current-owner', email: 'current@example.com', username: 'current', projectCount: 3 });
    });

    const deleteAction = createProjectRouteActions({ navigate, project }).find((action: any) => action.key === 'delete');
    expect(deleteAction).toBeDefined();
    await deleteAction!.onClick();

    expect(window.alert).toHaveBeenCalledWith('Failed to delete project');
    expect(navigate).not.toHaveBeenCalled();
  });
});
