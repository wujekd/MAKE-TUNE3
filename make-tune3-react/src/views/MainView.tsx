import React, { useContext, useEffect, useState } from 'react';
import { AudioEngineContext } from '../audio-services/AudioEngineContext';
import { StoreTest } from '../components/StoreTest';
import { useAppStore } from '../stores/appStore';
import './MainView.css';
import SubmissionItem from '../components/SubmissionItem';
import Favorites from '../components/Favorites';
import { Mixer } from '../components/Mixer';
import { DebugInfo } from '../components/DebugInfo';
import ProjectHistory from '../components/ProjectHistory';

interface MainViewProps {
  onShowAuth: () => void;
}

export function MainView({ onShowAuth }: MainViewProps) {
  const audioContext = useContext(AudioEngineContext);
  const [debug, setDebug] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  // Get data from different slices
  const { user, signOut } = useAppStore(state => state.auth);
  const { 
    regularTracks, 
    pastStageTracks, 
    backingTrack,
    markAsListened,
    addToFavorites,
    removeFromFavorites,
    voteFor,
    isTrackListened,
    isTrackFavorite,
    getTrackById
  } = useAppStore(state => state.collaboration);
  const { playSubmission, playPastSubmission } = useAppStore(state => state.playback);
  const { setShowAuth } = useAppStore(state => state.ui);

  if (!audioContext) {
    return <div>Audio engine not available</div>;
  }

  const { engine, state } = audioContext;

  useEffect(() => {
    if (engine) {
        engine.setTrackListenedCallback(
          (trackSrc) => { 
            console.log('🎧 Track listened callback triggered for:', trackSrc);
            // Find track by file path and mark as listened
            const track = regularTracks.find(t => t.filePath === trackSrc);
            console.log('🎧 Found track:', track);
            if (track) {
              console.log('🎧 Marking track as listened:', track.id);
              markAsListened(track.id);
            } else {
              console.log('🎧 Track not found for filePath:', trackSrc);
            }
          },
          7, // listenedRatio
          (trackSrc) => {
            const track = regularTracks.find(t => t.filePath === trackSrc);
            return track ? isTrackListened(track.id) : false;
          }
        );
    }
  }, [engine, markAsListened, regularTracks, isTrackListened]);

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
        onClick={() => console.log('favourites:', regularTracks.filter(t => isTrackFavorite(t.id)))}
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
      
      <div className="submissions-section">
        <div className="audio-player-section">
            <Favorites  
              onRemoveFromFavorites={(trackId) => removeFromFavorites(trackId)}
              allTracks={regularTracks}
              isTrackFavorite={isTrackFavorite}
              onAddToFavorites={(trackId) => addToFavorites(trackId)}
              onPlay={(trackId, index, favorite) => playSubmission(trackId, index, favorite)}
              voteFor={voteFor}
              listenedRatio={7}
              finalVote={null}
            />
          <div className="audio-player-title">Submissions</div>
            <div style={{ display: 'flex', flexDirection: 'row', gap: '10px', flexWrap: 'wrap' }}>
              {regularTracks.filter(track => !isTrackFavorite(track.id)).map((track, index) => (
                <SubmissionItem 
                    key={track.id}
                    track={track}
                    index={index}
                    isCurrentTrack={state.player1.source === track.filePath}
                    isPlaying={state.player1.isPlaying}
                    listened={isTrackListened(track.id)}
                    favorite={isTrackFavorite(track.id)}
                    onAddToFavorites={() => addToFavorites(track.id)}
                    onPlay={(trackId, index, favorite) => playSubmission(trackId, index, false)}
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