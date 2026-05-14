import { describe, expect, it, beforeEach, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ProjectsTab } from '../../components/ProjectsTab';

const hoisted = vi.hoisted(() => ({
  listMyProjectsOverview: vi.fn(),
  listUserProjects: vi.fn(),
  createProjectWithUniqueName: vi.fn(),
  recountMyProjectCount: vi.fn(),
  listMyModerationQueue: vi.fn(),
  listMyGroups: vi.fn()
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
  },
  GroupService: {
    listMyGroups: hoisted.listMyGroups
  }
}));

vi.mock('../../components/ProjectListItem', () => ({
  ProjectListItem: ({ projectName }: { projectName: string }) => <div data-testid="project-item">{projectName}</div>
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
    hoisted.listMyGroups.mockReset();

    hoisted.listMyProjectsOverview.mockResolvedValue([]);
    hoisted.listUserProjects.mockResolvedValue([]);
    hoisted.recountMyProjectCount.mockResolvedValue(0);
    hoisted.listMyModerationQueue.mockResolvedValue([]);
    hoisted.listMyGroups.mockResolvedValue([]);
  });

  it('loads projects and moderation queue once, then reloads moderation when opening queue', async () => {
    hoisted.listMyProjectsOverview.mockResolvedValue([
      {
        projectId: 'project-1',
        projectName: 'Existing Project',
        description: '',
        createdAt: 1700000000000,
        updatedAt: 1700000000000,
        currentCollaboration: null
      }
    ]);

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

  it('opens the create form when requested from the dashboard CTA', async () => {
    hoisted.listMyProjectsOverview.mockResolvedValue([
      {
        projectId: 'project-1',
        projectName: 'Existing Project',
        description: '',
        createdAt: 1700000000000,
        updatedAt: 1700000000000,
        currentCollaboration: null
      }
    ]);

    render(
      <MemoryRouter>
        <ProjectsTab
          user={{ uid: 'user-1', email: 'user@example.com', tier: 'beta', projectCount: 1, bonusProjects: 0 } as any}
          authLoading={false}
          createProjectRequestKey={1}
        />
      </MemoryRouter>
    );

    expect(await screen.findByRole('heading', { name: /create project/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/project name/i)).toBeInTheDocument();
    expect(screen.queryByText('Existing Project')).not.toBeInTheDocument();
  });
});
