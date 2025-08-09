import { useContext, useEffect, useState } from 'react';
import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { AudioEngineContext } from '../audio-services/AudioEngineContext';
import { StoreTest } from '../components/StoreTest';
import { useAppStore } from '../stores/appStore';
import './MainView.css';
import SubmissionItem from '../components/SubmissionItem';
import Favorites from '../components/Favorites';
import { Mixer } from '../components/Mixer';
// import { SubmissionEQ } from '../components/SubmissionEQ';
import { DebugInfo } from '../components/DebugInfo';
import ProjectHistory from '../components/ProjectHistory';
import { storage } from '../services/firebase';
import { ref, getDownloadURL } from 'firebase/storage';

export function MainView() {
  const audioContext = useContext(AudioEngineContext);
  const [isLoading, setIsLoading] = useState(true);
  
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
  const { setShowAuth } = useAppStore(state => state.ui);

  if (!audioContext) {
    return <div>Audio engine not available</div>;
  }
  const { engine, state } = audioContext;

  // read collabId from url
  const location = useLocation();
  const collabId = useMemo(() => {
    const match = location.pathname.match(/\/collab\/(.+)$/);
    return match ? decodeURIComponent(match[1]) : null;
  }, [location.pathname]);

  // load collaboration data based on url and auth
  useEffect(() => {
    if (!collabId) return;
    if (user) {
      loadCollaboration(user.uid, collabId);
    } else {
      loadCollaborationAnonymousById(collabId);
    }
  }, [collabId, user, loadCollaboration, loadCollaborationAnonymousById]);

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
      const track = collaboration.regularTracks.find(t => t.filePath === clean);
      if (track) {
        collaboration.markAsListened(track.filePath);
      }
    };
    const isListened = (trackSrc: string) => {
      const clean = srcToFilePath(trackSrc);
      const { collaboration } = useAppStore.getState();
      return collaboration.isTrackListened(clean);
    };
    engine.setTrackListenedCallback(onListened, 7, isListened);
    return () => {
      engine.clearTrackListenedCallback();
    };
  }, [engine]);

  // Resolve and preload backing track for faster first play
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!engine) return;
      const path = backingTrack?.filePath || '';
      if (!path) return;
      try {
        let url = '';
        if (path.startsWith('/test-audio/')) url = path;
        else if (!path.startsWith('collabs/')) url = `/test-audio/${path}`;
        else url = await getDownloadURL(ref(storage, path));
        if (!cancelled && url) {
          engine.preloadBacking(url);
        }
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [engine, backingTrack?.filePath]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 100);
    
    return () => clearTimeout(timer);
  }, [user?.uid]);

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

  return (
    <div className="main-container">
      <div className="abs-tl"><button onClick={() => (window.location.href = '/collabs')}>← back</button></div>
      <StoreTest />
      <button 
        style={{
          position: 'absolute',
          top: '20px',
          right: '140px',
          zIndex: 1000,
        }}
        onClick={() => console.log('playingFavourite:', state.playerController.playingFavourite)}
      >
        Log Playback Mode
      </button>
      <button 
        style={{
          position: 'absolute',
          top: '20px',
          right: '270px',
          zIndex: 1000,
        }}
        onClick={() => console.log('favourites:', regularTracks.filter(t => isTrackFavorite(t.filePath)))}
      >
        Log Favorites
      </button>
      {user ? (
        <button 
          style={{
            position: 'absolute',
            top: '20px',
            right: '400px',
            zIndex: 1000,
          }}
          onClick={signOut}
        >
          Logout ({user.email})
        </button>
      ) : (
        <button 
          style={{
            position: 'absolute',
            top: '20px',
            right: '400px',
            zIndex: 1000,
          }}
          onClick={() => setShowAuth(true)}
        >
          Login
        </button>
      )}
      <div className="info-top">
        <h2>Audio Engine Test</h2>
          <DebugInfo engine={engine} />
          <ProjectHistory />
      </div>
      
      <div className={`submissions-section ${!state.playerController.pastStagePlayback ? 'active-playback' : ''}`}>
        <div className="audio-player-section">
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
            <div className="row gap-16 wrap submissions-scroll">
              {regularTracks.filter(track => !isTrackFavorite(track.filePath)).map((track, index) => (
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
                    onPlay={(filePath, index) => playSubmission(filePath, index, false)}
                    voteFor={voteFor}
                    listenedRatio={7}
                    isFinal={false}
                />
              ))}
            </div>
        </div>
      </div>
      <Mixer 
        state={state} 
      />
    </div>
  );
}