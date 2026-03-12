import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { UserActivityPanel } from '../../components/UserActivityPanel';
import { useAppStore } from '../../stores/appStore';

const hoisted = vi.hoisted(() => ({
  listMySubmissionCollabs: vi.fn(),
  listMyDownloadedCollabs: vi.fn(),
  getCollaborationMeta: vi.fn()
}));

vi.mock('../../services/submissionService', () => ({
  SubmissionService: {
    listMySubmissionCollabs: hoisted.listMySubmissionCollabs
  }
}));

vi.mock('../../services/dashboardService', () => ({
  DashboardService: {
    listMyDownloadedCollabs: hoisted.listMyDownloadedCollabs
  }
}));

vi.mock('../../services/dashboardCollaborationMetaService', () => ({
  DashboardCollaborationMetaService: {
    getCollaborationMeta: hoisted.getCollaborationMeta
  }
}));

vi.mock('../../components/ProjectsTab', () => ({
  ProjectsTab: () => <div data-testid="projects-tab">projects tab</div>
}));

vi.mock('../../components/UserActivityListItem', () => ({
  UserActivityListItem: ({ title }: { title: string }) => <div data-testid="activity-item">{title}</div>
}));

vi.mock('../../components/LoadingSpinner', () => ({
  LoadingSpinner: () => <div data-testid="loading-spinner">loading</div>
}));

const initialAppState = useAppStore.getState();

describe('UserActivityPanel', () => {
  beforeEach(() => {
    hoisted.listMySubmissionCollabs.mockReset();
    hoisted.listMyDownloadedCollabs.mockReset();
    hoisted.getCollaborationMeta.mockReset();

    hoisted.listMySubmissionCollabs.mockResolvedValue([]);
    hoisted.listMyDownloadedCollabs.mockResolvedValue([
      {
        collabId: 'collab-1',
        projectName: 'Demo Project',
        collaborationName: 'Demo Collaboration',
        status: 'completed'
      }
    ]);
    hoisted.getCollaborationMeta.mockResolvedValue(null);

    act(() => {
      useAppStore.setState(initialAppState, true);
      useAppStore.setState(state => ({
        ...state,
        auth: {
          ...state.auth,
          user: { uid: 'user-1', email: 'user@example.com' } as any,
          loading: false
        }
      }));
    });
  });

  afterEach(() => {
    act(() => {
      useAppStore.setState(initialAppState, true);
    });
  });

  it('loads activity data once and does not refetch when returning to activity tab', async () => {
    render(
      <MemoryRouter>
        <UserActivityPanel />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(hoisted.listMySubmissionCollabs).toHaveBeenCalledTimes(1);
      expect(hoisted.listMyDownloadedCollabs).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByRole('button', { name: /my projects/i }));
    fireEvent.click(screen.getByRole('button', { name: /my activity/i }));

    await waitFor(() => {
      expect(hoisted.listMySubmissionCollabs).toHaveBeenCalledTimes(1);
      expect(hoisted.listMyDownloadedCollabs).toHaveBeenCalledTimes(1);
    });
  });
});
