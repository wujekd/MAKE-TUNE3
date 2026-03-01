import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { AdminFeedbackView } from '../../views/AdminFeedbackView';
import { useAppStore } from '../../stores/appStore';

const hoisted = vi.hoisted(() => ({
  getAllFeedback: vi.fn(),
  updateFeedbackStatus: vi.fn(),
  grantCreatorAccess: vi.fn()
}));

vi.mock('../../services/feedbackService', () => ({
  FeedbackService: {
    getAllFeedback: hoisted.getAllFeedback,
    updateFeedbackStatus: hoisted.updateFeedbackStatus,
    grantCreatorAccess: hoisted.grantCreatorAccess
  }
}));

vi.mock('../../components/AdminLayout', () => ({
  AdminLayout: ({ children }: { children: ReactNode }) => <div data-testid="admin-layout">{children}</div>
}));

const initialAppState = useAppStore.getState();

describe('AdminFeedbackView', () => {
  beforeEach(() => {
    hoisted.getAllFeedback.mockReset();
    hoisted.updateFeedbackStatus.mockReset();
    hoisted.grantCreatorAccess.mockReset();
    hoisted.getAllFeedback.mockResolvedValue([]);

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

  it('loads feedback on mount and reloads when filters change', async () => {
    render(<AdminFeedbackView />);

    await waitFor(() => {
      expect(hoisted.getAllFeedback).toHaveBeenCalledWith(undefined);
    });

    const selects = screen.getAllByRole('combobox');

    fireEvent.change(selects[0], { target: { value: 'bug' } });
    await waitFor(() => {
      expect(hoisted.getAllFeedback).toHaveBeenCalledWith({ category: 'bug' });
    });

    fireEvent.change(selects[1], { target: { value: 'new' } });
    await waitFor(() => {
      expect(hoisted.getAllFeedback).toHaveBeenCalledWith({ category: 'bug', status: 'new' });
    });
  });
});
