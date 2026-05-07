import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { DashboardCollabsPanel } from '../../components/DashboardCollabsPanel';

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

describe('DashboardCollabsPanel', () => {
  it('renders a unified feed with feed options and recommendation metadata', () => {
    render(
      <MemoryRouter>
        <DashboardCollabsPanel {...defaultProps} />
      </MemoryRouter>
    );

    expect(screen.getByText('collaboration feed')).toBeInTheDocument();
    expect(screen.getByText('recommended')).toBeInTheDocument();
    expect(screen.getByText('latest')).toBeInTheDocument();
    expect(screen.getByText('ending soon')).toBeInTheDocument();
    expect(screen.getByText('completed')).toBeInTheDocument();
    expect(screen.getByText('Night Shift')).toBeInTheDocument();
    expect(screen.getByText('Moonlight Project')).toBeInTheDocument();
    expect(screen.getByText('rank #1 · score 0.912')).toBeInTheDocument();
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

    fireEvent.click(screen.getByText('latest'));
    expect(onFeedModeChange).toHaveBeenCalledWith('latest');
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

    expect(screen.getByText('no collaborations match the current tags')).toBeInTheDocument();
  });
});
