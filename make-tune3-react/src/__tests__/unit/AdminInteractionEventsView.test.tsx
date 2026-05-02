import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { AdminInteractionEventsView } from '../../views/AdminInteractionEventsView';
import { useAppStore } from '../../stores/appStore';

const hoisted = vi.hoisted(() => ({
  listInteractionEvents: vi.fn()
}));

vi.mock('../../services', async (importOriginal) => {
  const actual = await importOriginal() as any;
  return {
    ...actual,
    AdminService: {
      ...actual.AdminService,
      listInteractionEvents: hoisted.listInteractionEvents
    }
  };
});

vi.mock('../../components/AdminLayout', () => ({
  AdminLayout: ({ children }: { children: ReactNode }) => <div data-testid="admin-layout">{children}</div>
}));

const initialAppState = useAppStore.getState();

describe('AdminInteractionEventsView', () => {
  beforeEach(() => {
    hoisted.listInteractionEvents.mockReset();
    hoisted.listInteractionEvents.mockResolvedValue({
      events: [
        {
          id: 'event-1',
          userId: 'user-1',
          projectId: 'project-1',
          collaborationId: 'collab-1',
          trackPath: 'tracks/a.mp3',
          entityType: 'submission',
          eventType: 'submission_like',
          createdAt: { toDate: () => new Date('2026-05-02T10:00:00Z') }
        }
      ],
      nextCursor: { id: 'cursor-1' },
      hasMore: true
    });

    act(() => {
      useAppStore.setState(initialAppState, true);
      useAppStore.setState(state => ({
        ...state,
        auth: {
          ...state.auth,
          user: { uid: 'admin-1', email: 'admin@example.com', isAdmin: true } as any,
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

  it('loads the first page on mount and renders events', async () => {
    render(<AdminInteractionEventsView />);

    await waitFor(() => {
      expect(hoisted.listInteractionEvents).toHaveBeenCalledWith({ pageSize: 25, cursor: null });
    });

    expect(screen.getByText('submission_like')).toBeInTheDocument();
    expect(screen.getByText('tracks/a.mp3')).toBeInTheDocument();
  });

  it('loads the next page with the returned cursor', async () => {
    hoisted.listInteractionEvents
      .mockResolvedValueOnce({
        events: [
          {
            id: 'event-1',
            userId: 'user-1',
            projectId: 'project-1',
            collaborationId: 'collab-1',
            trackPath: 'tracks/a.mp3',
            entityType: 'submission',
            eventType: 'submission_like',
            createdAt: { toDate: () => new Date('2026-05-02T10:00:00Z') }
          }
        ],
        nextCursor: { id: 'cursor-1' },
        hasMore: true
      })
      .mockResolvedValueOnce({
        events: [
          {
            id: 'event-2',
            userId: 'user-2',
            projectId: null,
            collaborationId: 'collab-2',
            trackPath: null,
            entityType: 'collaboration',
            eventType: 'collaboration_favorite',
            createdAt: { toDate: () => new Date('2026-05-02T09:00:00Z') }
          }
        ],
        nextCursor: { id: 'cursor-2' },
        hasMore: false
      });

    render(<AdminInteractionEventsView />);

    await waitFor(() => {
      expect(hoisted.listInteractionEvents).toHaveBeenNthCalledWith(1, { pageSize: 25, cursor: null });
    });

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    await waitFor(() => {
      expect(hoisted.listInteractionEvents).toHaveBeenNthCalledWith(2, {
        pageSize: 25,
        cursor: { id: 'cursor-1' }
      });
    });

    expect(screen.getByText('collaboration_favorite')).toBeInTheDocument();
  });

  it('shows access denied for non-admin users', () => {
    act(() => {
      useAppStore.setState(state => ({
        ...state,
        auth: {
          ...state.auth,
          user: { uid: 'user-1', email: 'user@example.com', isAdmin: false } as any,
          loading: false
        }
      }));
    });

    render(<AdminInteractionEventsView />);

    expect(screen.getByText('Access denied. Admin privileges required.')).toBeInTheDocument();
  });
});
