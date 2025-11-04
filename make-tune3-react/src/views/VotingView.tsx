import { useContext, useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AudioEngineContext } from '../audio-services/AudioEngineContext';
import { useAppStore } from '../stores/appStore';
import { useUIStore } from '../stores';
import './MainView.css';
import SubmissionItem from '../components/SubmissionItem';
import Favorites from '../components/Favorites';
import { Mixer } from '../components/Mixer';
import { DebugInfo } from '../components/DebugInfo';
import ProjectHistory from '../components/ProjectHistory';
import { CollabHeader } from '../components/CollabHeader';
import { CollabViewShell } from '../components/CollabViewShell';
import { useCollaborationLoader } from '../hooks/useCollaborationLoader';
import { useStageRedirect } from '../hooks/useStageRedirect';
import { useResolvedAudioUrl } from '../hooks/useResolvedAudioUrl';
import { useAudioPreload } from '../hooks/useAudioPreload';

export function VotingView() {
  const audioContext = useContext(AudioEngineContext);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();
  
  // get data from different slices
  const { user, signOut } = useAppStore(state => state.auth);
  const { 
    regularTracks,
    favorites,
    backingTrack,
    loadCollaboration,
    loadCollaborationAnonymousById,
    // markAsListened,
    addToFavorites,
    removeFromFavorites,
    voteFor,
    isTrackListened,
    isTrackFavorite
  } = useAppStore(state => state.collaboration);
  const { playSubmission } = useAppStore(state => state.playback);
  const { currentProject, currentCollaboration } = useAppStore(state => state.collaboration);
  const { setShowAuth } = useUIStore();

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
    return <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      height: '100vh',
      backgroundColor: 'var(--background)',
      color: 'var(--white)'
    }}>
      Loading...
    </div>;
  }

  const headerLeft = (
    <>
      <div className="mv-header-col">
        <div className="mv-title">{currentProject?.name || ''}</div>
        <div className="mv-subtitle">project description: {currentProject?.description || ''}</div>
      </div>
      <div className="mv-header-col">
        <div className="mv-title">{currentCollaboration?.name || ''}</div>
        <div className="mv-subtitle">collaboration description: {currentCollaboration?.description || ''}</div>
      </div>
    </>
  );

  const headerRight = (
    <>
      <ProjectHistory />
      <CollabHeader collaboration={currentCollaboration} onStageChange={handleStageChange} />
    </>
  );

  const mainClassName = !state.playerController.pastStagePlayback ? 'active-playback' : undefined;

  return (
    <CollabViewShell
      headerClassName="mv-fixed"
      headerLeft={headerLeft}
      headerRight={headerRight}
      mainClassName={mainClassName}
      mixer={state ? <Mixer state={state} /> : null}
    >
      <Favorites
        onRemoveFromFavorites={(trackId) => removeFromFavorites(trackId)}
        favorites={favorites}
        onAddToFavorites={(trackId) => addToFavorites(trackId)}
        onPlay={(trackId, index, favorite) => playSubmission(trackId, index, favorite)}
        voteFor={voteFor}
        listenedRatio={7}
        finalVote={useAppStore.getState().collaboration.userCollaboration?.finalVote || null}
      />
      <div className="audio-player-title">Submissions</div>
      <div className="submissions-scroll submissions-scroll--grid">
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
            />
          ))}
      </div>
    </CollabViewShell>
  );
}
