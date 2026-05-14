import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DashboardView } from '../../views/DashboardView';
import { useAppStore } from '../../stores/appStore';

const hoisted = vi.hoisted(() => ({
  getDashboardStats: vi.fn(),
  loadFeed: vi.fn(),
  getActiveCollaborationTags: vi.fn(),
  listPublicGroups: vi.fn(),
  listMyGroups: vi.fn()
}));

vi.mock('../../services/dashboardService', () => ({
  DashboardService: {
    getDashboardStats: hoisted.getDashboardStats
  }
}));

vi.mock('../../services/dashboardFeedService', () => ({
  DashboardFeedService: {
    loadFeed: hoisted.loadFeed
  }
}));

vi.mock('../../services/tagService', () => ({
  TagService: {
    getActiveCollaborationTags: hoisted.getActiveCollaborationTags
  }
}));

vi.mock('../../services/groupService', () => ({
  GroupService: {
    listPublicGroups: hoisted.listPublicGroups,
    listMyGroups: hoisted.listMyGroups
  }
}));

vi.mock('../../components/DashboardCollabsPanel', () => ({
  DashboardCollabsPanel: () => <div data-testid="explore-workbench">Explore workbench</div>
}));

vi.mock('../../components/UserActivityPanel', () => ({
  UserActivityPanel: ({
    createProjectRequestKey,
    projectsPanelRequestKey,
    activeTabOverride,
    hideTabs
  }: {
    createProjectRequestKey?: number;
    projectsPanelRequestKey?: number;
    activeTabOverride?: string;
    hideTabs?: boolean;
  }) => (
    <div
      data-testid="user-activity-workbench"
      data-create-key={createProjectRequestKey}
      data-projects-key={projectsPanelRequestKey}
      data-active-tab={activeTabOverride}
      data-hide-tabs={String(Boolean(hideTabs))}
    >
      User activity workbench
    </div>
  )
}));

vi.mock('../../components/AudioRouteBoundary', () => ({
  AudioRouteBoundary: ({ children }: { children: ReactNode }) => <>{children}</>
}));

vi.mock('../../components/LoadingSpinner', () => ({
  LoadingSpinner: () => <div data-testid="loading-spinner">loading</div>
}));

const initialAppState = useAppStore.getState();

describe('DashboardView console workbench', () => {
  beforeEach(() => {
    hoisted.getDashboardStats.mockReset();
    hoisted.loadFeed.mockReset();
    hoisted.getActiveCollaborationTags.mockReset();
    hoisted.listPublicGroups.mockReset();
    hoisted.listMyGroups.mockReset();

    hoisted.getDashboardStats.mockResolvedValue({
      totalCollabs: 12,
      totalSubmissions: 4,
      totalVotes: 9,
      activeCollabs: 3
    });
    hoisted.loadFeed.mockResolvedValue({ items: [], metaLabel: 'ready' });
    hoisted.getActiveCollaborationTags.mockResolvedValue([]);
    hoisted.listPublicGroups.mockResolvedValue([]);
    hoisted.listMyGroups.mockResolvedValue([]);

    act(() => {
      useAppStore.setState(initialAppState, true);
      useAppStore.setState(state => ({
        ...state,
        auth: {
          ...state.auth,
          loading: false,
          user: {
            uid: 'user-1',
            email: 'user@example.com',
            username: 'tester',
            tier: 'beta',
            projectCount: 0
          } as any
        }
      }));
    });
  });

  it('defaults to explore and switches to the groups placeholder without moving the console', async () => {
    render(
      <MemoryRouter>
        <DashboardView />
      </MemoryRouter>
    );

    expect(await screen.findByTestId('explore-workbench')).toBeInTheDocument();
    expect(screen.getByLabelText('Dashboard console')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^Groups$/i }));

    expect(screen.getByRole('heading', { name: /^Groups$/i })).toBeInTheDocument();
    expect(screen.queryByTestId('explore-workbench')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Dashboard console')).toBeInTheDocument();
  });

  it('wires profile CTAs into the project and account workbenches', async () => {
    render(
      <MemoryRouter>
        <DashboardView />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(hoisted.loadFeed).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByRole('button', { name: /create project/i }));
    expect(screen.getByTestId('user-activity-workbench')).toHaveAttribute('data-create-key', '1');
    expect(screen.getByTestId('user-activity-workbench')).toHaveAttribute('data-active-tab', 'projects');
    expect(screen.getByTestId('user-activity-workbench')).toHaveAttribute('data-hide-tabs', 'true');

    fireEvent.click(within(screen.getByLabelText('Profile actions')).getByRole('button', { name: /^Account$/i }));
    expect(screen.getByRole('heading', { name: /^Account$/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /open full account/i })).toHaveAttribute('href', '/account');

    fireEvent.click(within(screen.getByLabelText('Profile actions')).getByRole('button', { name: /my projects/i }));
    expect(screen.getByTestId('user-activity-workbench')).toHaveAttribute('data-projects-key', '1');
  });

  it('exposes my activity as a project control option', async () => {
    render(
      <MemoryRouter>
        <DashboardView />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(hoisted.loadFeed).toHaveBeenCalled();
    });

    fireEvent.click(within(screen.getByLabelText('Profile actions')).getByRole('button', { name: /my projects/i }));
    fireEvent.click(screen.getByRole('button', { name: /my activity/i }));

    expect(screen.getByTestId('user-activity-workbench')).toHaveAttribute('data-active-tab', 'activity');
    expect(within(screen.getByLabelText('Profile controls')).getByRole('button', { name: /^my projects$/i })).toBeInTheDocument();
  });

  it('keeps profile controls in a stable order across account, projects, and activity', async () => {
    render(
      <MemoryRouter>
        <DashboardView />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(hoisted.loadFeed).toHaveBeenCalled();
    });

    const modeOrder = () => (
      within(screen.getByLabelText('Profile controls'))
        .getAllByRole('button')
        .slice(0, 3)
        .map(button => button.textContent)
    );

    fireEvent.click(within(screen.getByLabelText('Profile actions')).getByRole('button', { name: /^Account$/i }));
    expect(modeOrder()).toEqual(['Account', 'My projects', 'My activity']);
    expect(within(screen.getByLabelText('Profile controls')).getByRole('button', { name: /^back to explore feed$/i })).toBeInTheDocument();

    fireEvent.click(within(screen.getByLabelText('Profile controls')).getByRole('button', { name: /^my projects$/i }));
    expect(modeOrder()).toEqual(['Account', 'My projects', 'My activity']);

    fireEvent.click(within(screen.getByLabelText('Profile controls')).getByRole('button', { name: /^my activity$/i }));
    expect(modeOrder()).toEqual(['Account', 'My projects', 'My activity']);
    expect(screen.getByTestId('user-activity-workbench')).toHaveAttribute('data-active-tab', 'activity');
  });
});
