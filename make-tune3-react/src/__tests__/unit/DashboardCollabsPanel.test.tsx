import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { DashboardCollabsPanel } from '../../components/DashboardCollabsPanel';
import { DashboardPlaceholderItem } from '../../components/DashboardPlaceholderItem';

vi.mock('../../components/BackingWaveformPreview', () => ({
  BackingWaveformPreview: () => <div data-testid="waveform-preview" />
}));

const defaultProps = {
  items: [
    {
      collaborationId: 'collab-1',
      collaborationName: 'Night Shift',
      collaborationStatus: 'submission',
      collaborationDescription: 'late session',
      collaborationTags: ['house'],
      collaborationTagsKey: ['house'],
      projectId: 'project-1',
      projectName: 'Moonlight Project',
      rank: 1,
      score: 0.9123,
      highlightedTrackPath: 'tracks/lead.wav',
      backingTrackPath: 'backings/demo.wav',
      backingWaveformPath: null,
      backingWaveformStatus: null,
      backingWaveformBucketCount: null,
      backingWaveformVersion: null,
      backingWaveformPreview: null,
      publishedAt: 1700000000000,
      submissionCloseAt: 1700003600000,
      votingCloseAt: 1700007200000,
      completedAt: null,
      updatedAt: 1700001800000,
      submissionDurationSeconds: 3600,
      votingDurationSeconds: 3600,
      generatedAt: '2026-05-04T12:00:00.000Z',
      modelVersion: 'hybrid-v1',
      source: 'recommended' as const
    }
  ],
  hasLoaded: true,
  error: null,
  selectedTags: [],
  onTagsChange: vi.fn(),
  availableTags: [{ key: 'house', name: 'House', count: 4 }],
  feedMode: 'recommended' as const,
  onFeedModeChange: vi.fn(),
  metaLabel: 'updated recently'
};

const makeItem = (overrides: Partial<typeof defaultProps.items[number]> = {}) => ({
  ...defaultProps.items[0],
  ...overrides
});

describe('DashboardCollabsPanel', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(1700001800000));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders a unified feed with feed options and recommendation metadata', () => {
    render(
      <MemoryRouter>
        <DashboardCollabsPanel {...defaultProps} />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { name: /explore feed/i })).toBeInTheDocument();
    expect(screen.getByText('Filter by Tags')).toBeInTheDocument();
    expect(screen.getByText('recommended')).toBeInTheDocument();
    expect(screen.getByText('newest')).toBeInTheDocument();
    expect(screen.getByText('popular')).toBeInTheDocument();
    expect(screen.getByText('ending soon')).toBeInTheDocument();
    expect(screen.getByText('Night Shift')).toBeInTheDocument();
    expect(screen.getByText('Moonlight Project')).toBeInTheDocument();
    expect(screen.getByText('highlight lead.wav')).toBeInTheDocument();
  });

  it('switches feed modes through the unified controls', () => {
    const onFeedModeChange = vi.fn();

    render(
      <MemoryRouter>
        <DashboardCollabsPanel
          {...defaultProps}
          onFeedModeChange={onFeedModeChange}
        />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByText('newest'));
    expect(onFeedModeChange).toHaveBeenCalledWith('newest');
  });

  it('shows a feed-specific empty state', () => {
    render(
      <MemoryRouter>
        <DashboardCollabsPanel
          {...defaultProps}
          items={[]}
          selectedTags={['house']}
        />
      </MemoryRouter>
    );

    expect(screen.getByText('No matches for these tags')).toBeInTheDocument();
    expect(screen.getByText('Try removing a tag or switching feed order.')).toBeInTheDocument();
  });

  it('renders merged status/progress slots for submission and voting collaboration rows', () => {
    const items = [
      makeItem({
        collaborationId: 'collab-submission',
        collaborationName: 'Submission Track',
        collaborationStatus: 'submission',
        submissionCloseAt: 1700003600000,
        submissionDurationSeconds: 3600
      }),
      makeItem({
        collaborationId: 'collab-voting',
        collaborationName: 'Voting Track',
        collaborationStatus: 'voting',
        submissionCloseAt: 1700000000000,
        votingCloseAt: 1700003600000,
        votingDurationSeconds: 3600
      })
    ];

    render(
      <MemoryRouter>
        <DashboardCollabsPanel {...defaultProps} items={items} />
      </MemoryRouter>
    );

    const submissionRow = screen.getByRole('link', { name: /Submission Track/i });
    const votingRow = screen.getByRole('link', { name: /Voting Track/i });
    const submissionProgress = within(submissionRow).getByRole('progressbar', { name: 'Submission progress' });
    const votingProgress = within(votingRow).getByRole('progressbar', { name: 'Voting progress' });

    expect(submissionProgress).toHaveClass('collab-list-item__status-progress');
    expect(votingProgress).toHaveClass('collab-list-item__status-progress');
    expect(within(submissionProgress).getByText('Submission')).toHaveClass('stage-status-progress__text');
    expect(within(votingProgress).getByText('Voting')).toHaveClass('stage-status-progress__text');
    expect(submissionProgress).toHaveAttribute('aria-valuenow', '50');
    expect(votingProgress).toHaveAttribute('aria-valuenow', '50');
  });

  it('renders a completed row with a full merged status/progress slot', () => {
    render(
      <MemoryRouter>
        <DashboardCollabsPanel
          {...defaultProps}
          items={[
            makeItem({
              collaborationId: 'collab-completed',
              collaborationName: 'Finished Track',
              collaborationStatus: 'completed',
              votingCloseAt: 1700000000000,
              updatedAt: 1700000000000
            })
          ]}
        />
      </MemoryRouter>
    );

    const completedRow = screen.getByRole('link', { name: /Finished Track/i });
    const completedProgress = within(completedRow).getByRole('progressbar', { name: 'Completed progress' });

    expect(completedProgress).toHaveClass('collab-list-item__status-progress');
    expect(within(completedProgress).getByText('Completed')).toHaveClass('stage-status-progress__text');
    expect(completedProgress).toHaveAttribute('aria-valuenow', '100');
  });

  it('keeps collaboration row navigation behavior intact', () => {
    render(
      <MemoryRouter>
        <DashboardCollabsPanel {...defaultProps} />
      </MemoryRouter>
    );

    expect(screen.getByRole('link', { name: /Night Shift/i })).toHaveAttribute('href', '/collab/collab-1/submit');
  });

  it('reserves equivalent status/progress and audio-row structure for collaboration placeholders', () => {
    const { container } = render(<DashboardPlaceholderItem variant="collaboration" />);
    const placeholder = container.querySelector('.dashboard-placeholder-item');

    expect(placeholder?.querySelector('.collab-list-item__status-progress')).toBeInTheDocument();
    expect(placeholder?.querySelector('.stage-status-progress__fill')).toBeInTheDocument();
    expect(placeholder?.querySelector('.stage-status-progress__text')).toBeInTheDocument();
    expect(placeholder?.querySelector('.stage-status-progress__percent')).toBeInTheDocument();
    expect(placeholder?.querySelector('.dashboard-placeholder-item__merged-progress-fill')).toBeInTheDocument();
    expect(placeholder?.querySelector('.dashboard-placeholder-item__bar--merged-status')).toBeInTheDocument();
    expect(placeholder?.querySelector('.dashboard-placeholder-item__bar--merged-percent')).toBeInTheDocument();
    expect(placeholder?.querySelector('.collab-list-item__audio-row')).toBeInTheDocument();
    expect(placeholder?.querySelector('.collab-list-item__footer')).toBeInTheDocument();
  });

  it('matches the shared status/progress structure for activity placeholders', () => {
    const { container } = render(<DashboardPlaceholderItem variant="activity" />);
    const placeholder = container.querySelector('.dashboard-placeholder-item');

    expect(placeholder?.querySelector('.user-activity-list-item__timeline-progress')).toBeInTheDocument();
    expect(placeholder?.querySelector('.user-activity-list-item__deadline-pill')).toBeInTheDocument();
    expect(placeholder?.querySelector('.user-activity-list-item__submission-pill')).toBeInTheDocument();
    expect(placeholder?.querySelector('.stage-status-progress__fill')).toBeInTheDocument();
    expect(placeholder?.querySelector('.stage-status-progress__text')).toBeInTheDocument();
    expect(placeholder?.querySelector('.stage-status-progress__percent')).toBeInTheDocument();
  });
});
