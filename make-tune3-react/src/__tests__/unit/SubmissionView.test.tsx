import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import { SubmissionView } from '../../views/SubmissionView';
import { AudioEngineContext } from '../../audio-services/AudioEngineContext';
import { useAppStore } from '../../stores/appStore';

const mockNavigate = vi.fn();

const hoisted = vi.hoisted(() => ({
  hasDownloadedBacking: vi.fn(),
  hasUserSubmitted: vi.fn(),
  getProject: vi.fn(),
  useAudioStore: vi.fn()
}));

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useParams: () => ({ collabId: 'collab-1' }),
    useNavigate: () => mockNavigate
  };
});

vi.mock('../../services', () => ({
  UserService: {
    hasDownloadedBacking: hoisted.hasDownloadedBacking
  },
  ProjectService: {
    getProject: hoisted.getProject
  }
}));

vi.mock('../../services/submissionService', () => ({
  SubmissionService: {
    hasUserSubmitted: hoisted.hasUserSubmitted
  }
}));

vi.mock('../../stores', () => ({
  useAudioStore: hoisted.useAudioStore
}));

vi.mock('../../services/storageService', () => ({
  resolveStorageDownloadUrl: vi.fn()
}));

vi.mock('../../components/Mixer', () => ({
  Mixer: () => <div data-testid="mixer">mixer</div>
}));

vi.mock('../../components/ProjectHistory', () => ({
  default: () => <div data-testid="project-history">history</div>
}));

vi.mock('../../components/CollabData', () => ({
  CollabData: () => <div data-testid="collab-data">data</div>
}));

vi.mock('../../components/CollabHeader', () => ({
  CollabHeader: () => <div data-testid="collab-header">header</div>
}));

vi.mock('../../components/DownloadBacking', () => ({
  DownloadBacking: () => <div data-testid="download-backing">download</div>
}));

vi.mock('../../components/UploadSubmission', () => ({
  UploadSubmission: ({ collaborationId }: { collaborationId: string }) => (
    <div data-testid="upload-submission">{collaborationId}</div>
  )
}));

vi.mock('../../components/LoadingSpinner', () => ({
  LoadingSpinner: () => <div data-testid="loading-spinner">loading</div>
}));

vi.mock('../../hooks/usePrefetchAudio', () => ({
  usePrefetchAudio: vi.fn()
}));

vi.mock('../../hooks/useWaveformData', () => ({
  useWaveformData: () => ({
    data: null,
    uiState: 'idle',
    meta: {},
    isLoading: false,
    timedOut: false
  })
}));

const initialAppState = useAppStore.getState();

describe('SubmissionView', () => {
  beforeEach(() => {
    vi.useRealTimers();
    mockNavigate.mockReset();
    hoisted.hasDownloadedBacking.mockReset();
    hoisted.hasUserSubmitted.mockReset();
    hoisted.getProject.mockReset();
    hoisted.useAudioStore.mockReset();

    hoisted.hasDownloadedBacking.mockResolvedValue(false);
    hoisted.hasUserSubmitted.mockResolvedValue(false);
    hoisted.getProject.mockResolvedValue(null);
    hoisted.useAudioStore.mockReturnValue({
      player1: { isPlaying: false, source: '', duration: 0, currentTime: 0, volume: 1 },
      player2: { isPlaying: false, source: '', duration: 0, currentTime: 0, volume: 1 }
    });

    act(() => {
      useAppStore.setState(initialAppState, true);
      useAppStore.setState(state => ({
        ...state,
        auth: {
          ...state.auth,
          user: null,
          loading: false
        },
        collaboration: {
          ...state.collaboration,
          currentCollaboration: {
            id: 'collab-1',
            projectId: '',
            status: 'submission',
            backingTrackPath: '',
            submissionsCount: 0
          } as any,
          refreshCollaborationStatus: vi.fn().mockResolvedValue(undefined),
          loadCollaboration: vi.fn().mockResolvedValue(undefined),
          loadCollaborationAnonymousById: vi.fn().mockResolvedValue(undefined)
        }
      }));
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    act(() => {
      useAppStore.setState(initialAppState, true);
    });
  });

  it('shows a login affordance for anonymous users once status resolves', async () => {
    const engine = {
      preloadBacking: vi.fn(),
      unlock: vi.fn().mockResolvedValue(undefined),
      clearSubmissionSource: vi.fn(),
      clearPlaybackSources: vi.fn()
    };

    await act(async () => {
      render(
        <AudioEngineContext.Provider value={{ engine: engine as any, state: {} as any }}>
          <SubmissionView />
        </AudioEngineContext.Provider>
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /login required/i })).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /log in/i })).toBeInTheDocument();
    expect(screen.queryByTestId('upload-submission')).not.toBeInTheDocument();

    expect(hoisted.hasDownloadedBacking).not.toHaveBeenCalled();
    expect(hoisted.hasUserSubmitted).not.toHaveBeenCalled();
  });

  it('shows missing collaboration info and redirects to main page when the collab does not exist', async () => {
    vi.useFakeTimers();

    act(() => {
      useAppStore.setState(state => ({
        ...state,
        collaboration: {
          ...state.collaboration,
          currentCollaboration: null,
          refreshCollaborationStatus: vi.fn().mockResolvedValue(undefined),
          loadCollaboration: vi.fn().mockResolvedValue(undefined),
          loadCollaborationAnonymousById: vi.fn().mockResolvedValue(undefined)
        }
      }));
    });

    await act(async () => {
      render(
        <AudioEngineContext.Provider value={{ engine: { clearPlaybackSources: vi.fn() } as any, state: {} as any }}>
          <SubmissionView />
        </AudioEngineContext.Provider>
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByText('This collaboration no longer exists.')).toBeInTheDocument();
    expect(screen.getByText(/Returning to the main page in 5 seconds\./i)).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(5000);
    });

    expect(mockNavigate).toHaveBeenCalledWith('/collabs', { replace: true });
  });
});
