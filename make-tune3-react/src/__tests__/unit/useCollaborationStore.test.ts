import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useCollaborationStore } from '../../stores/useCollaborationStore';

const initialState = useCollaborationStore.getState();

describe('useCollaborationStore', () => {
  beforeEach(() => {
    useCollaborationStore.setState(initialState, true);
  });

  afterEach(() => {
    useCollaborationStore.setState(initialState, true);
  });

  it('places favorite file paths outside the regular track list', () => {
    const now = new Date() as any;

    useCollaborationStore.setState({
      currentCollaboration: {
        id: 'collab-1'
      } as any,
      userCollaboration: {
        userId: 'user-1',
        collaborationId: 'collab-1',
        favoriteTracks: ['collabs/collab-1/submissions/fav.mp3'],
        listenedTracks: [],
        listenedRatio: 0,
        finalVote: null,
        lastInteraction: now,
        createdAt: now
      }
    });

    const { setTracks } = useCollaborationStore.getState();

    setTracks([
      { filePath: 'collabs/collab-1/submissions/fav.mp3' },
      { filePath: 'collabs/collab-1/submissions/regular.mp3' }
    ]);

    const state = useCollaborationStore.getState();

    expect(state.allTracks.map(track => track.filePath)).toEqual([
      'collabs/collab-1/submissions/fav.mp3',
      'collabs/collab-1/submissions/regular.mp3'
    ]);
    expect(state.regularTracks.map(track => track.filePath)).toEqual([
      'collabs/collab-1/submissions/regular.mp3'
    ]);
  });
});

