import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { DashboardRecommendationsPanel } from '../../components/DashboardRecommendationsPanel';
import { useAppStore } from '../../stores/appStore';

const hoisted = vi.hoisted(() => ({
  listMyRecommendations: vi.fn()
}));

vi.mock('../../services/recommendationService', () => ({
  RecommendationService: {
    listMyRecommendations: hoisted.listMyRecommendations
  }
}));

vi.mock('../../components/UserActivityListItem', () => ({
  UserActivityListItem: ({
    title,
    subtitle,
    metaLines
  }: {
    title: string;
    subtitle?: string;
    metaLines?: string[];
  }) => (
    <div data-testid="recommendation-item">
      <div>{title}</div>
      <div>{subtitle}</div>
      {metaLines?.map(line => <div key={line}>{line}</div>)}
    </div>
  )
}));

vi.mock('../../components/DashboardPlaceholderItem', () => ({
  DashboardPlaceholderItem: () => <div data-testid="recommendation-placeholder">loading</div>
}));

const initialAppState = useAppStore.getState();

describe('DashboardRecommendationsPanel', () => {
  beforeEach(() => {
    hoisted.listMyRecommendations.mockReset();
    hoisted.listMyRecommendations.mockResolvedValue([]);

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

  it('renders hydrated recommendations for signed-in users', async () => {
    hoisted.listMyRecommendations.mockResolvedValue([
      {
        collaborationId: 'collab-1',
        collaborationName: 'Night Shift',
        collaborationStatus: 'submission',
        collaborationDescription: 'late session',
        collaborationTags: ['house'],
        projectId: 'project-1',
        projectName: 'Moonlight Project',
        rank: 1,
        score: 0.9123,
        highlightedTrackPath: 'tracks/lead.wav',
        backingTrackPath: 'backings/demo.wav',
        publishedAt: 1700000000000,
        submissionCloseAt: 1700003600000,
        votingCloseAt: 1700007200000,
        updatedAt: 1700001800000,
        submissionDurationSeconds: 3600,
        votingDurationSeconds: 3600,
        generatedAt: '2026-05-04T12:00:00.000Z',
        modelVersion: 'hybrid-v1'
      }
    ]);

    render(
      <MemoryRouter>
        <DashboardRecommendationsPanel />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(hoisted.listMyRecommendations).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByText(/recommended for you/i)).toBeInTheDocument();
    expect(screen.getByText('Night Shift')).toBeInTheDocument();
    expect(screen.getByText('Moonlight Project')).toBeInTheDocument();
    expect(screen.getByText('rank #1 · score 0.912')).toBeInTheDocument();
    expect(screen.getByText('highlight lead.wav')).toBeInTheDocument();
  });

  it('shows an empty state when the user has no recommendations yet', async () => {
    render(
      <MemoryRouter>
        <DashboardRecommendationsPanel />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/no recommendations yet/i)).toBeInTheDocument();
    });
  });

  it('renders nothing for anonymous users', () => {
    act(() => {
      useAppStore.setState(state => ({
        ...state,
        auth: {
          ...state.auth,
          user: null,
          loading: false
        }
      }));
    });

    const { container } = render(
      <MemoryRouter>
        <DashboardRecommendationsPanel />
      </MemoryRouter>
    );

    expect(container).toBeEmptyDOMElement();
    expect(hoisted.listMyRecommendations).not.toHaveBeenCalled();
  });
});
