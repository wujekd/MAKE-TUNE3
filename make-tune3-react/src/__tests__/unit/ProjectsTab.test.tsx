import { describe, expect, it, beforeEach, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ProjectsTab } from '../../components/ProjectsTab';

const hoisted = vi.hoisted(() => ({
  listMyProjectsOverview: vi.fn(),
  listUserProjects: vi.fn(),
  createProjectWithUniqueName: vi.fn(),
  recountMyProjectCount: vi.fn(),
  listMyModerationQueue: vi.fn()
}));

vi.mock('../../services', () => ({
  DashboardService: {
    listMyProjectsOverview: hoisted.listMyProjectsOverview
  },
  ProjectService: {
    listUserProjects: hoisted.listUserProjects,
    createProjectWithUniqueName: hoisted.createProjectWithUniqueName,
    recountMyProjectCount: hoisted.recountMyProjectCount
  },
  CollaborationService: {
    listMyModerationQueue: hoisted.listMyModerationQueue
  }
}));

vi.mock('../../components/ProjectListItem', () => ({
  ProjectListItem: ({ title }: { title: string }) => <div data-testid="project-item">{title}</div>
}));

vi.mock('../../components/UserActivityListItem', () => ({
  UserActivityListItem: ({ title }: { title: string }) => <div data-testid="moderation-item">{title}</div>
}));

vi.mock('../../components/LoadingSpinner', () => ({
  LoadingSpinner: () => <div data-testid="loading-spinner">loading</div>
}));

describe('ProjectsTab', () => {
  beforeEach(() => {
    hoisted.listMyProjectsOverview.mockReset();
    hoisted.listUserProjects.mockReset();
    hoisted.createProjectWithUniqueName.mockReset();
    hoisted.recountMyProjectCount.mockReset();
    hoisted.listMyModerationQueue.mockReset();

    hoisted.listMyProjectsOverview.mockResolvedValue([]);
    hoisted.listUserProjects.mockResolvedValue([]);
    hoisted.recountMyProjectCount.mockResolvedValue(0);
    hoisted.listMyModerationQueue.mockResolvedValue([]);
  });

  it('loads projects and moderation queue once, then reloads moderation when opening queue', async () => {
    render(
      <MemoryRouter>
        <ProjectsTab
          user={{ uid: 'user-1', email: 'user@example.com', tier: 'beta', projectCount: 0, bonusProjects: 0 } as any}
          authLoading={false}
        />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(hoisted.listMyProjectsOverview).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(hoisted.listMyModerationQueue).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByRole('button', { name: /review\s*queue/i }));

    await waitFor(() => {
      expect(hoisted.listMyModerationQueue).toHaveBeenCalledTimes(2);
    });

    expect(hoisted.listMyProjectsOverview).toHaveBeenCalledTimes(1);
  });
});
