import { useContext, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AudioEngineContext } from '../audio-services/AudioEngineContext';
import { useAppStore } from '../stores/appStore';
import './MainView.css';
import SubmissionItem from '../components/SubmissionItem';
import Favorites from '../components/Favorites';
import { Mixer } from '../components/Mixer';
import ProjectHistory from '../components/ProjectHistory';
import { CollabData } from '../components/CollabData';
import { CollabHeader } from '../components/CollabHeader';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { useCollaborationLoader } from '../hooks/useCollaborationLoader';
import { useStageRedirect } from '../hooks/useStageRedirect';
import { useResolvedAudioUrl } from '../hooks/useResolvedAudioUrl';
import { useAudioPreload } from '../hooks/useAudioPreload';
import { MissingCollaborationState } from '../components/MissingCollaborationState';
import { CollaborationPreferenceBar } from '../components/CollaborationPreferenceBar';
import styles from './VotingView.module.css';

export function VotingView() {
  const audioContext = useContext(AudioEngineContext);
  const navigate = useNavigate();
  const { collabId } = useParams();
  const stageCheckInFlightRef = useRef(false);

  // get data from different slices
  const { user } = useAppStore(state => state.auth);
  const {
    regularTracks,
    favorites,
    backingTrack,
    loadCollaboration,
    loadCollaborationAnonymousById,
    addToFavorites,
    removeFromFavorites,
    likeTrack,
    unlikeTrack,
    voteFor,
    isTrackListened,
    isTrackLiked,
    isTrackFavorite,
    isLoadingCollaboration,
    pendingFavoriteActions,
    pendingTrackLikeActions,
    pendingVotes,
    userCollaboration,
    likeCollaboration,
    unlikeCollaboration,
    favoriteCollaboration,
    unfavoriteCollaboration,
    isUpdatingCollaborationLike,
    isUpdatingCollaborationFavorite
  } = useAppStore(state => state.collaboration);
  const { playSubmission } = useAppStore(state => state.playback);
  const { currentProject, currentCollaboration } = useAppStore(state => state.collaboration);

  const engine = audioContext?.engine;
  const state = audioContext?.state;

  const loader = useCollaborationLoader(collabId);
  const requestedCollaboration = currentCollaboration?.id === collabId ? currentCollaboration : null;
  const requestedProject =
    requestedCollaboration && currentProject?.id === requestedCollaboration.projectId
      ? currentProject
      : null;
  const timelineStatus = requestedCollaboration?.status ?? 'voting';

  useStageRedirect({
    expected: 'voting',
    collaboration: requestedCollaboration,
    collabId: collabId ?? undefined,
    navigate
  });

  const { url: backingUrl } = useResolvedAudioUrl(backingTrack?.filePath);
  useAudioPreload(backingUrl);

  useEffect(() => {
    if (!engine) return;
    const srcToFilePath = (src: string): string => {
      if (!src) return '';
      if (src.startsWith('/test-audio/')) return src.replace('/test-audio/', '');
      if (src.startsWith('http')) {
        const idx = src.indexOf('/o/');
        if (idx !== -1) {
          let rest = src.substring(idx + 3);
          const q = rest.indexOf('?');
          if (q !== -1) rest = rest.substring(0, q);
          try { return decodeURIComponent(rest); } catch { return rest; }
        }
      }
      return src;
    };
    const onListened = (trackSrc: string) => {
      const clean = srcToFilePath(trackSrc);
      const { collaboration } = useAppStore.getState();
      const track = collaboration.allTracks.find(t => t.filePath === clean || t.optimizedPath === clean);
      if (track) {
        collaboration.markAsListened(track.filePath);
      }
    };
    const isListened = (trackSrc: string) => {
      const clean = srcToFilePath(trackSrc);
      const { collaboration } = useAppStore.getState();
      const track = collaboration.allTracks.find(t => t.filePath === clean || t.optimizedPath === clean);
      if (!track) return false;
      return collaboration.isTrackListened(track.filePath);
    };
    engine.setTrackListenedCallback(onListened, 7, isListened);
    return () => {
      engine.clearTrackListenedCallback();
    };
  }, [engine]);

  useEffect(() => {
    if (!engine) return;
    return () => {
      engine.clearPlaybackSources();
    };
  }, [engine]);

  const handleStageChange = useCallback(async () => {
    if (stageCheckInFlightRef.current) return;
    stageCheckInFlightRef.current = true;
    try {
      const current = useAppStore.getState().collaboration.currentCollaboration;
      if (!current) return;
      if (user) {
        await loadCollaboration(user.uid, current.id);
      } else {
        await loadCollaborationAnonymousById(current.id);
      }
      const updated = useAppStore.getState().collaboration.currentCollaboration;
      if (!updated) return;
      if (updated.status === 'completed') {
        navigate(`/collab/${updated.id}/completed`);
      }
    } catch (err) {
      console.warn('[VotingView] stage change refresh failed', err);
    } finally {
      stageCheckInFlightRef.current = false;
    }
  }, [user, loadCollaboration, loadCollaborationAnonymousById, navigate]);

  const isVotingLoading = isLoadingCollaboration
    || loader.status === 'loading'
    || !requestedCollaboration;

  if (loader.status === 'not_found') {
    return <MissingCollaborationState collaborationId={collabId} viewLabel="voting view" />;
  }

  if (!audioContext || !state) {
    return <div>Audio engine not available</div>;
  }

  if (isVotingLoading) {
    return (
      <div className={`view-container ${styles.container}`}>
        <div className={styles.loadingState}>
          <LoadingSpinner size={36} />
          <div className={styles.loadingText}>Loading voting view…</div>
        </div>
      </div>
    );
  }

  return (
    <div className={`view-container ${styles.container}`}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.headerCol}>
            <div className={styles.title}>{requestedProject?.name || ''}</div>
            <div className={styles.subtitle}>{requestedProject?.description || ''}</div>
          </div>
          <div className={styles.headerCol}>
            <div className={styles.title}>{requestedCollaboration?.name || ''}</div>
            <div className={styles.subtitle}>{requestedCollaboration?.description || ''}</div>
            <CollaborationPreferenceBar
              disabled={!user}
              liked={Boolean(userCollaboration?.likedCollaboration)}
              favorited={Boolean(userCollaboration?.favoritedCollaboration)}
              isUpdatingLike={isUpdatingCollaborationLike}
              isUpdatingFavorite={isUpdatingCollaborationFavorite}
              onToggleLike={() => {
                if (userCollaboration?.likedCollaboration) {
                  unlikeCollaboration();
                } else {
                  likeCollaboration();
                }
              }}
              onToggleFavorite={() => {
                if (userCollaboration?.favoritedCollaboration) {
                  unfavoriteCollaboration();
                } else {
                  favoriteCollaboration();
                }
              }}
            />
          </div>
        </div>
        <div className={styles.headerRight}>
          <ProjectHistory />
          <CollabData collab={requestedCollaboration as any} />
          <CollabHeader
            collaboration={requestedCollaboration}
            onStageChange={handleStageChange}
            displayStatus={timelineStatus}
          />
        </div>
      </div>

      <div className={styles.content}>
        <div className={styles.submissionsSection}>
          <div className={styles.audioPlayerSection}>
            {isVotingLoading ? (
              <div className={styles.loadingState}>
                <LoadingSpinner size={36} />
                <div className={styles.loadingText}>Loading voting view…</div>
              </div>
            ) : (
              <>
                <Favorites
                  onRemoveFromFavorites={(trackId) => removeFromFavorites(trackId)}
                  favorites={favorites}
                  onAddToFavorites={(trackId) => addToFavorites(trackId)}
                  onToggleLike={(trackId) => {
                    if (isTrackLiked(trackId)) {
                      unlikeTrack(trackId);
                    } else {
                      likeTrack(trackId);
                    }
                  }}
                  isTrackLiked={isTrackLiked}
                  onPlay={(trackId, index, favorite) => playSubmission(trackId, index, favorite)}
                  voteFor={voteFor}
                  listenedRatio={7}
                  finalVote={useAppStore.getState().collaboration.userCollaboration?.finalVote || null}
                  pendingFavoriteActions={pendingFavoriteActions}
                  pendingLikeActions={pendingTrackLikeActions}
                  pendingVotes={pendingVotes}
                />
                <div className={styles.audioPlayerTitle}>Submissions</div>
                <div className={styles.submissionsScroll}>
                  {regularTracks
                    .filter(track => !isTrackFavorite(track.filePath))
                    .map((track, index) => (
                      <SubmissionItem
                        key={track.id}
                        track={track}
                        index={index}
                        isCurrentTrack={
                          !state.playerController.pastStagePlayback &&
                          !state.playerController.playingFavourite &&
                          state.playerController.currentTrackId === index
                        }
                        isPlaying={state.player1.isPlaying}
                        listened={isTrackListened(track.filePath)}
                        liked={isTrackLiked(track.filePath)}
                        favorite={isTrackFavorite(track.filePath)}
                        onToggleLike={() => {
                          if (isTrackLiked(track.filePath)) {
                            unlikeTrack(track.filePath);
                          } else {
                            likeTrack(track.filePath);
                          }
                        }}
                        onAddToFavorites={() => addToFavorites(track.filePath)}
                        onPlay={(filePath, idx) => playSubmission(filePath, idx, false)}
                        voteFor={voteFor}
                        listenedRatio={7}
                        isFinal={false}
                        pendingFavoriteAction={pendingFavoriteActions[track.filePath]}
                        pendingLikeAction={pendingTrackLikeActions[track.filePath]}
                        isVoting={!!pendingVotes[track.filePath]}
                      />
                    ))}
                </div>
              </>
            )}
          </div>
        </div>

        <div className={`mixer-theme ${styles.mixerSection}`}>
          {state && <Mixer state={state} />}
        </div>
      </div>
    </div>
  );
}
