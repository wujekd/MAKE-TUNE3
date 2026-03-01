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
    useParams: () => ({ collaborationId: 'collab-1' }),
    useNavigate: () => mockNavigate
  };
});

vi.mock('../../services', () => ({
  UserService: {
    hasDownloadedBacking: hoisted.hasDownloadedBacking
  },
  SubmissionService: {
    hasUserSubmitted: hoisted.hasUserSubmitted
  },
  ProjectService: {
    getProject: hoisted.getProject
  }
}));

vi.mock('../../stores', () => ({
  useAudioStore: hoisted.useAudioStore
}));

vi.mock('../../services/firebase', () => ({
  storage: {}
}));

vi.mock('firebase/storage', () => ({
  ref: vi.fn(),
  getDownloadURL: vi.fn()
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

const initialAppState = useAppStore.getState();

describe('SubmissionView', () => {
  beforeEach(() => {
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
          refreshCollaborationStatus: vi.fn().mockResolvedValue(undefined)
        }
      }));
    });
  });

  afterEach(() => {
    act(() => {
      useAppStore.setState(initialAppState, true);
    });
  });

  it('shows upload pane for anonymous users once status resolves', async () => {
    const engine = {
      preloadBacking: vi.fn(),
      unlock: vi.fn().mockResolvedValue(undefined),
      clearSubmissionSource: vi.fn(),
      clearPlaybackSources: vi.fn()
    };

    render(
      <AudioEngineContext.Provider value={{ engine: engine as any, state: {} as any }}>
        <SubmissionView />
      </AudioEngineContext.Provider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('upload-submission')).toHaveTextContent('collab-1');
    });

    expect(hoisted.hasDownloadedBacking).not.toHaveBeenCalled();
    expect(hoisted.hasUserSubmitted).not.toHaveBeenCalled();
  });
});
