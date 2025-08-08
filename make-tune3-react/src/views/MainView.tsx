import React, { useContext, useEffect, useState } from 'react';
import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { AudioEngineContext } from '../audio-services/AudioEngineContext';
import { StoreTest } from '../components/StoreTest';
import { useAppStore } from '../stores/appStore';
import './MainView.css';
import SubmissionItem from '../components/SubmissionItem';
import Favorites from '../components/Favorites';
import { Mixer } from '../components/Mixer';
import { SubmissionEQ } from '../components/SubmissionEQ';
import { DebugInfo } from '../components/DebugInfo';
import ProjectHistory from '../components/ProjectHistory';

interface MainViewProps {
  onShowAuth: () => void;
}

export function MainView({ onShowAuth }: MainViewProps) {
  const audioContext = useContext(AudioEngineContext);
  const [debug, setDebug] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  // get data from different slices
  const { user, signOut } = useAppStore(state => state.auth);
  const { 
    regularTracks,
    favorites,
    loadCollaboration,
    loadCollaborationAnonymousById,
    markAsListened,
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
    const onListened = (trackSrc: string) => {
      const clean = trackSrc.replace('/test-audio/', '');
      const { collaboration } = useAppStore.getState();
      const track = collaboration.regularTracks.find(t => t.filePath === clean);
      if (track) {
        collaboration.markAsListened(track.filePath);
      }
    };
    const isListened = (trackSrc: string) => {
      const clean = trackSrc.replace('/test-audio/', '');
      const { collaboration } = useAppStore.getState();
      return collaboration.isTrackListened(clean);
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
      <div style={{ position: 'absolute', top: 16, left: 16, zIndex: 1000 }}>
        <button
          onClick={() => (window.location.href = '/collabs')}
          style={{
            padding: '8px 12px',
            borderRadius: 6,
            border: '1px solid var(--border-color, #333)',
            background: 'var(--primary1-700)',
            color: 'var(--white)'
          }}
        >
          ← back to collabs
        </button>
      </div>
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
              finalVote={null}
            />
          <div className="audio-player-title">Submissions</div>
            <div style={{ display: 'flex', flexDirection: 'row', gap: '10px', flexWrap: 'wrap' }}>
              {regularTracks.filter(track => !isTrackFavorite(track.filePath)).map((track, index) => (
                <SubmissionItem 
                    key={track.id}
                    track={track}
                    index={index}
                    isCurrentTrack={!state.playerController.pastStagePlayback && state.player1.source === `/test-audio/${track.filePath}`}
                    isPlaying={state.player1.isPlaying}
                                          listened={isTrackListened(track.filePath)}
                                          favorite={isTrackFavorite(track.filePath)}
                      onAddToFavorites={() => addToFavorites(track.filePath)}
                    onPlay={(filePath, index, favorite) => playSubmission(filePath, index, false)}
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