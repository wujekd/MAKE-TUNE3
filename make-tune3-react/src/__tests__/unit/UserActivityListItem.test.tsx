import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { UserActivityListItem } from '../../components/UserActivityListItem';

describe('UserActivityListItem', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(1700001800000));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('uses the shared merged status/progress control for activity rows', () => {
    render(
      <MemoryRouter>
        <UserActivityListItem
          title="Night Shift"
          subtitle="Moonlight Project"
          status="voting"
          stageInfo={{
            status: 'voting',
            startAt: 1700000000000,
            endAt: 1700003600000,
            label: 'voting ends soon'
          }}
          metaLines={['last downloaded today']}
          deadlineLabel="30m left"
          deadlineDetail="voting deadline 11/14/2023, 11:13:20 PM"
          submissionLabel="not submitted yet"
          submissionTone="missing"
          to="/collab/collab-1"
          actionLabel="open"
        />
      </MemoryRouter>
    );

    const row = screen.getByRole('link', { name: /Night Shift/i });
    const progress = within(row).getByRole('progressbar', { name: 'Voting progress' });

    expect(progress).toHaveClass('stage-status-progress');
    expect(progress).toHaveClass('user-activity-list-item__timeline-progress');
    expect(progress).toHaveAttribute('aria-valuenow', '50');
    expect(within(progress).getByText('Voting')).toHaveClass('stage-status-progress__text');
    expect(within(progress).getByText('50%')).toHaveClass('stage-status-progress__percent');
    expect(within(row).getByText('30m left')).toHaveClass('user-activity-list-item__deadline-pill');
    expect(within(row).getByText('not submitted yet')).toHaveClass('user-activity-list-item__submission-pill--missing');
    expect(row.querySelector('.item-progress')).not.toBeInTheDocument();
  });
});
