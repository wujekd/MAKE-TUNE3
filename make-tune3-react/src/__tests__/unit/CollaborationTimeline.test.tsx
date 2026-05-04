import { act, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CollaborationTimeline } from '../../components/CollaborationTimeline';

describe('CollaborationTimeline', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('updates the visible submission seconds as time advances', () => {
    render(
      <CollaborationTimeline
        status="submission"
        publishedAt={Date.now() - 60_000}
        submissionCloseAt={Date.now() + 3_000}
        votingCloseAt={Date.now() + 60_000}
      />
    );

    const submissionPhase = screen.getByText('Submission').closest('.collab-timeline__phase');
    expect(submissionPhase).not.toBeNull();

    const readValues = () =>
      Array.from(submissionPhase!.querySelectorAll('.timer-display__value')).map(node => node.textContent);

    expect(readValues()).toEqual(['00', '00', '00', '03']);
    expect(within(screen.getByText('Voting').closest('.collab-timeline__phase')!).getByText('pending')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1_000);
    });

    expect(readValues()).toEqual(['00', '00', '00', '02']);
  });
});
