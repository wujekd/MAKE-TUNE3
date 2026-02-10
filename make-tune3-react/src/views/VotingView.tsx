import { useContext, useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AudioEngineContext } from '../audio-services/AudioEngineContext';
import { useAppStore } from '../stores/appStore';
import './MainView.css';
import SubmissionItem from '../components/SubmissionItem';
import Favorites from '../components/Favorites';
import { Mixer } from '../components/Mixer';
import ProjectHistory from '../components/ProjectHistory';
import { CollabData } from '../components/CollabData';
import { CollabHeader } from '../components/CollabHeader';
import { useCollaborationLoader } from '../hooks/useCollaborationLoader';
import { useStageRedirect } from '../hooks/useStageRedirect';
import { useResolvedAudioUrl } from '../hooks/useResolvedAudioUrl';
import { useAudioPreload } from '../hooks/useAudioPreload';
import styles from './VotingView.module.css';

export function VotingView() {
  const audioContext = useContext(AudioEngineContext);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

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
    voteFor,
    isTrackListened,
    isTrackFavorite,
    pendingFavoriteActions,
    pendingVotes
  } = useAppStore(state => state.collaboration);
  const { playSubmission } = useAppStore(state => state.playback);
  const { currentProject, currentCollaboration } = useAppStore(state => state.collaboration);

  if (!audioContext) {
    return <div>Audio engine not available</div>;
  }
  const { engine, state } = audioContext;
  const stageCheckInFlightRef = useRef(false);

  // read collabId from url
  const location = useLocation();
  const collabId = useMemo(() => {
    const match = location.pathname.match(/\/collab\/(.+)$/);
    return match ? decodeURIComponent(match[1]) : null;
  }, [location.pathname]);
  const timelineStatus = currentCollaboration?.id === collabId ? currentCollaboration.status : 'voting';

  useCollaborationLoader(collabId);
  useStageRedirect({
    expected: 'voting',
    collaboration: currentCollaboration,
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

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 100);

    return () => clearTimeout(timer);
  }, [user?.uid]);

  const handleStageChange = useCallback(async (nextStatus: 'voting' | 'completed') => {
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

  if (isLoading) {
    return <div className={styles.loading}>Loading...</div>;
  }

  return (
    <div className={`view-container ${styles.container}`}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.headerCol}>
            <div className={styles.title}>{currentProject?.name || ''}</div>
            <div className={styles.subtitle}>{currentProject?.description || ''}</div>
          </div>
          <div className={styles.headerCol}>
            <div className={styles.title}>{currentCollaboration?.name || ''}</div>
            <div className={styles.subtitle}>{currentCollaboration?.description || ''}</div>
          </div>
        </div>
        <div className={styles.headerRight}>
          <ProjectHistory />
          <CollabData collab={currentCollaboration as any} />
          <CollabHeader
            collaboration={currentCollaboration}
            onStageChange={handleStageChange}
            displayStatus={timelineStatus}
          />
        </div>
      </div>

      <div className={styles.content}>
        <div className={styles.submissionsSection}>
          <div className={styles.audioPlayerSection}>
            <Favorites
              onRemoveFromFavorites={(trackId) => removeFromFavorites(trackId)}
              favorites={favorites}
              onAddToFavorites={(trackId) => addToFavorites(trackId)}
              onPlay={(trackId, index, favorite) => playSubmission(trackId, index, favorite)}
              voteFor={voteFor}
              listenedRatio={7}
              finalVote={useAppStore.getState().collaboration.userCollaboration?.finalVote || null}
              pendingFavoriteActions={pendingFavoriteActions}
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
                    favorite={isTrackFavorite(track.filePath)}
                    onAddToFavorites={() => addToFavorites(track.filePath)}
                    onPlay={(filePath, idx) => playSubmission(filePath, idx, false)}
                    voteFor={voteFor}
                    listenedRatio={7}
                    isFinal={false}
                    pendingFavoriteAction={pendingFavoriteActions[track.filePath]}
                    isVoting={!!pendingVotes[track.filePath]}
                  />
                ))}
            </div>
          </div>
        </div>

        <div className={`mixer-theme ${styles.mixerSection}`}>
          {state && <Mixer state={state} />}
        </div>
      </div>
    </div>
  );
}
