import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAppStore } from '../../stores/appStore';
import { useAudioStore } from '../../stores';
import type { Track, Collaboration, Project } from '../../types/collaboration';

// Mock Firebase services
vi.mock('../../services/firebase', () => ({
    auth: {},
    storage: {},
    db: {}
}));

vi.mock('../../services/authService', () => ({
    AuthService: {
        loginWithEmail: vi.fn(),
        registerWithEmail: vi.fn(),
        signInWithGooglePopup: vi.fn(),
        signOut: vi.fn(),
        resetPassword: vi.fn(),
        getUserProfile: vi.fn()
    }
}));

vi.mock('../../services', async (importOriginal) => {
    const actual = await importOriginal() as any;
    return {
        ...actual,
        CollaborationService: {
            getFirstCollaboration: vi.fn()
        },
        ProjectService: {
            getProject: vi.fn()
        },
        UserService: {
            getUserCollaborations: vi.fn()
        },
        InteractionService: {
            markTrackAsListened: vi.fn(),
            addTrackToFavorites: vi.fn(),
            removeTrackFromFavorites: vi.fn(),
            voteForTrack: vi.fn()
        },
        DataService: {
            loadCollaborationData: vi.fn(),
            loadCollaborationDataAnonymous: vi.fn(),
            loadCollaborationStatus: vi.fn()
        },
        SubmissionService: {
            setSubmissionModeration: vi.fn()
        },
        // TrackUtils imported separately from utils (not mocked)
    };
});

vi.mock('firebase/storage', () => ({
    ref: vi.fn(),
    getDownloadURL: vi.fn()
}));

// UI and Audio slices moved to separate stores (useUIStore, useAudioStore)
// See useUIStore.test.ts and useAudioStore.test.ts for their tests

describe('AppStore - Collaboration Slice', () => {
    beforeEach(() => {
        useAppStore.setState({
            collaboration: {
                currentProject: null,
                currentCollaboration: null,
                userCollaboration: null,
                userCollaborations: [],
                allTracks: [],
                regularTracks: [],
                pastStageTracks: [],
                backingTrack: null,
                favorites: [],
                isLoadingCollaboration: false,
                isLoadingProject: false,
                isUpdatingFavorites: false,
                isUpdatingListened: false,
                setCurrentProject: useAppStore.getState().collaboration.setCurrentProject,
                setCurrentCollaboration: useAppStore.getState().collaboration.setCurrentCollaboration,
                setUserCollaboration: useAppStore.getState().collaboration.setUserCollaboration,
                setUserCollaborations: useAppStore.getState().collaboration.setUserCollaborations,
                setTracks: useAppStore.getState().collaboration.setTracks,
                markAsListened: useAppStore.getState().collaboration.markAsListened,
                addToFavorites: useAppStore.getState().collaboration.addToFavorites,
                removeFromFavorites: useAppStore.getState().collaboration.removeFromFavorites,
                voteFor: useAppStore.getState().collaboration.voteFor,
                setListenedRatio: useAppStore.getState().collaboration.setListenedRatio,
                loadUserCollaborations: useAppStore.getState().collaboration.loadUserCollaborations,
                loadCollaboration: useAppStore.getState().collaboration.loadCollaboration,
                loadCollaborationAnonymous: useAppStore.getState().collaboration.loadCollaborationAnonymous,
                loadCollaborationAnonymousById: useAppStore.getState().collaboration.loadCollaborationAnonymousById,
                loadCollaborationForModeration: useAppStore.getState().collaboration.loadCollaborationForModeration,
                refreshCollaborationStatus: useAppStore.getState().collaboration.refreshCollaborationStatus,
                loadProject: useAppStore.getState().collaboration.loadProject,
                isTrackListened: useAppStore.getState().collaboration.isTrackListened,
                isTrackFavorite: useAppStore.getState().collaboration.isTrackFavorite,
                getTrackByFilePath: useAppStore.getState().collaboration.getTrackByFilePath,
                approveSubmission: useAppStore.getState().collaboration.approveSubmission,
                rejectSubmission: useAppStore.getState().collaboration.rejectSubmission
            }
        });
    });

    it('should initialize with empty collaboration state', () => {
        const { collaboration } = useAppStore.getState();

        expect(collaboration.currentProject).toBeNull();
        expect(collaboration.currentCollaboration).toBeNull();
        expect(collaboration.userCollaboration).toBeNull();
        expect(collaboration.allTracks).toEqual([]);
        expect(collaboration.regularTracks).toEqual([]);
        expect(collaboration.favorites).toEqual([]);
    });

    it('should set current project', () => {
        const { collaboration } = useAppStore.getState();
        const mockProject: Project = {
            id: 'project-1',
            name: 'Test Project',
            description: 'Test description',
            ownerId: 'user-1',
            isActive: true,
            pastCollaborations: [],
            tags: [],
            tagsKey: [],
            createdAt: new Date() as any,
            updatedAt: new Date() as any
        };

        collaboration.setCurrentProject(mockProject);

        expect(useAppStore.getState().collaboration.currentProject).toBe(mockProject);
    });

    it('should set current collaboration', () => {
        const { collaboration } = useAppStore.getState();
        const mockCollaboration: Collaboration = {
            id: 'collab-1',
            projectId: 'project-1',
            name: 'Test Collaboration',
            description: 'Test description',
            status: 'submission',
            backingTrackPath: 'path/to/backing.mp3',
            submissionDuration: 7,
            votingDuration: 3,
            publishedAt: null,
            participantIds: [],
            submissions: [],
            tags: [],
            tagsKey: [],
            createdAt: new Date() as any,
            updatedAt: new Date() as any
        };

        collaboration.setCurrentCollaboration(mockCollaboration);

        expect(useAppStore.getState().collaboration.currentCollaboration).toBe(mockCollaboration);
    });

    it('should find track by file path', () => {
        const mockTracks: Track[] = [
            {
                id: 'track-1',
                title: 'Track 1',
                filePath: 'path/to/track1.mp3',
                duration: 180,
                createdAt: new Date() as any,
                collaborationId: 'collab-1',
                category: 'submission',
                approved: true
            },
            {
                id: 'track-2',
                title: 'Track 2',
                filePath: 'path/to/track2.mp3',
                duration: 200,
                createdAt: new Date() as any,
                collaborationId: 'collab-1',
                category: 'submission',
                approved: true
            }
        ];

        useAppStore.setState({
            collaboration: {
                ...useAppStore.getState().collaboration,
                allTracks: mockTracks
            }
        });

        const { collaboration } = useAppStore.getState();
        const found = collaboration.getTrackByFilePath('path/to/track1.mp3');

        expect(found).toBeDefined();
        expect(found?.id).toBe('track-1');
        expect(found?.title).toBe('Track 1');
    });

    it('should return undefined for non-existent track', () => {
        const { collaboration } = useAppStore.getState();
        const found = collaboration.getTrackByFilePath('non-existent.mp3');

        expect(found).toBeUndefined();
    });

    it('should check if track is favorite', () => {
        const mockTrack: Track = {
            id: 'track-1',
            title: 'Favorite Track',
            filePath: 'path/to/favorite.mp3',
            duration: 180,
            createdAt: new Date() as any,
            collaborationId: 'collab-1',
            category: 'submission',
            approved: true
        };

        useAppStore.setState({
            collaboration: {
                ...useAppStore.getState().collaboration,
                favorites: [mockTrack]
            }
        });

        const { collaboration } = useAppStore.getState();

        expect(collaboration.isTrackFavorite('path/to/favorite.mp3')).toBe(true);
        expect(collaboration.isTrackFavorite('path/to/other.mp3')).toBe(false);
    });

    it('should check if track is listened for authenticated user', () => {
        useAppStore.setState({
            auth: {
                ...useAppStore.getState().auth,
                user: { uid: 'user-1', email: 'test@example.com' } as any
            },
            collaboration: {
                ...useAppStore.getState().collaboration,
                userCollaboration: {
                    userId: 'user-1',
                    collaborationId: 'collab-1',
                    listenedTracks: ['path/to/listened.mp3'],
                    favoriteTracks: [],
                    finalVote: null,
                    listenedRatio: 80,
                    lastInteraction: new Date() as any,
                    createdAt: new Date() as any
                }
            }
        });

        const { collaboration } = useAppStore.getState();

        expect(collaboration.isTrackListened('path/to/listened.mp3')).toBe(true);
        expect(collaboration.isTrackListened('path/to/other.mp3')).toBe(false);
    });

    it('should return false for listened check when user is anonymous', () => {
        useAppStore.setState({
            auth: {
                ...useAppStore.getState().auth,
                user: null
            }
        });

        const { collaboration } = useAppStore.getState();

        expect(collaboration.isTrackListened('any-path.mp3')).toBe(false);
    });

    it('should set listened ratio', () => {
        useAppStore.setState({
            collaboration: {
                ...useAppStore.getState().collaboration,
                userCollaboration: {
                    userId: 'user-1',
                    collaborationId: 'collab-1',
                    listenedTracks: [],
                    favoriteTracks: [],
                    finalVote: null,
                    listenedRatio: 50,
                    lastInteraction: new Date() as any,
                    createdAt: new Date() as any
                }
            }
        });

        const { collaboration } = useAppStore.getState();
        collaboration.setListenedRatio(75);

        expect(useAppStore.getState().collaboration.userCollaboration?.listenedRatio).toBe(75);
    });

    it('should not set listened ratio when no user collaboration', () => {
        const { collaboration } = useAppStore.getState();

        // Should not throw
        collaboration.setListenedRatio(75);

        expect(useAppStore.getState().collaboration.userCollaboration).toBeNull();
    });
});

describe('AppStore - Playback Slice', () => {
    beforeEach(() => {
        // Audio slice is now in useAudioStore
        useAudioStore.setState({
            engine: null,
            state: null
        });
    });

    it('should format time correctly', () => {
        const { playback } = useAppStore.getState();
        const mockState = {
            player1: { currentTime: 125, duration: 300 },
            player2: { currentTime: 0, duration: 0 },
            playerController: { pastStagePlayback: false }
        } as any;

        const currentTime = playback.getCurrentTime(mockState);
        const totalTime = playback.getTotalTime(mockState);

        expect(currentTime).toBe('2:05');
        expect(totalTime).toBe('5:00');
    });

    it('should calculate time slider value', () => {
        const { playback } = useAppStore.getState();
        const mockState = {
            player1: { currentTime: 150, duration: 300 },
            player2: { currentTime: 0, duration: 0 },
            playerController: { pastStagePlayback: false }
        } as any;

        const sliderValue = playback.getTimeSliderValue(mockState);

        expect(sliderValue).toBe(50); // 150/300 * 100
    });

    it('should return 0 for slider value when duration is 0', () => {
        const { playback } = useAppStore.getState();
        const mockState = {
            player1: { currentTime: 0, duration: 0 },
            player2: { currentTime: 0, duration: 0 },
            playerController: { pastStagePlayback: false }
        } as any;

        const sliderValue = playback.getTimeSliderValue(mockState);

        expect(sliderValue).toBe(0);
    });

    // Backing-only mode tests (when player1 has no duration but player2 does)
    it('should use player2 for slider value when player1 has no duration (backing-only mode)', () => {
        const { playback } = useAppStore.getState();
        const mockState = {
            player1: { currentTime: 0, duration: 0 },
            player2: { currentTime: 60, duration: 180 },
            playerController: { pastStagePlayback: false }
        } as any;

        const sliderValue = playback.getTimeSliderValue(mockState);
        expect(sliderValue).toBeCloseTo(33.33, 1); // 60/180 * 100
    });

    it('should use player2 for getCurrentTime when player1 has no duration (backing-only mode)', () => {
        const { playback } = useAppStore.getState();
        const mockState = {
            player1: { currentTime: 0, duration: 0 },
            player2: { currentTime: 90, duration: 180 },
            playerController: { pastStagePlayback: false }
        } as any;

        const currentTime = playback.getCurrentTime(mockState);
        expect(currentTime).toBe('1:30');
    });

    it('should use player2 for getTotalTime when player1 has no duration (backing-only mode)', () => {
        const { playback } = useAppStore.getState();
        const mockState = {
            player1: { currentTime: 0, duration: 0 },
            player2: { currentTime: 0, duration: 240 },
            playerController: { pastStagePlayback: false }
        } as any;

        const totalTime = playback.getTotalTime(mockState);
        expect(totalTime).toBe('4:00');
    });

    it('should call seekBacking when player1 has no duration (backing-only mode)', () => {
        const mockEngine = {
            seekBacking: vi.fn()
        };

        useAudioStore.setState({
            engine: mockEngine as any,
            state: {
                player1: { currentTime: 0, duration: 0 },
                player2: { currentTime: 0, duration: 180 },
                playerController: { pastStagePlayback: false }
            } as any
        });

        const { playback } = useAppStore.getState();
        playback.handleTimeSliderChange(50); // 50% of 180 = 90 seconds

        expect(mockEngine.seekBacking).toHaveBeenCalledWith(90);
    });

    it('should handle submission volume change', () => {
        const mockEngine = {
            setVolume: vi.fn()
        };

        useAudioStore.setState({
            engine: mockEngine as any
        });

        const { playback } = useAppStore.getState();
        playback.handleSubmissionVolumeChange(0.75);

        expect(mockEngine.setVolume).toHaveBeenCalledWith(1, 0.75);
    });

    it('should handle master volume change', () => {
        const mockEngine = {
            setMasterVolume: vi.fn()
        };

        useAudioStore.setState({
            engine: mockEngine as any
        });

        const { playback } = useAppStore.getState();
        playback.handleMasterVolumeChange(0.5);

        expect(mockEngine.setMasterVolume).toHaveBeenCalledWith(0.5);
    });

    it('should toggle play/pause', () => {
        const mockEngine = {
            togglePlayback: vi.fn()
        };

        useAudioStore.setState({
            engine: mockEngine as any
        });

        const { playback } = useAppStore.getState();
        playback.togglePlayPause();

        expect(mockEngine.togglePlayback).toHaveBeenCalled();
    });

    it('should not throw when engine is null', () => {
        const { playback } = useAppStore.getState();

        expect(() => playback.handleSubmissionVolumeChange(0.5)).not.toThrow();
        expect(() => playback.handleMasterVolumeChange(0.5)).not.toThrow();
        expect(() => playback.togglePlayPause()).not.toThrow();
    });
});
