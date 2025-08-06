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
  
  const {
    user,
    signOut,
    regularSubmissions,
    pastStageTracklist,
    backingTrackSrc,
    favourites,
    listened,
    finalVote,
    listenedRatio,
    markAsListened,
    addToFavourites,
    removeFromFavourites,
    voteFor,
    playSubmission,
    playPastSubmission
  } = useAppStore();

  if (!audioContext) {
    return <div>Audio engine not available</div>;
  }

  const { engine, state } = audioContext;

  useEffect(() => {
    if (engine) {
        engine.setTrackListenedCallback(
          (trackSrc) => { markAsListened(trackSrc) },
          listenedRatio,
          (trackSrc) => listened.includes(trackSrc)
        );
    }
  }, [engine, listenedRatio, markAsListened, listened]);

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
          right: '10px',
          zIndex: 1000,
        }}
        onClick={() => setDebug(!debug)}
      >
        {debug ? 'Show History' : 'Show Debug'}
      </button>
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
        onClick={() => console.log('favourites:', favourites)}
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
          onClick={onShowAuth}
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
            <Favorites  onRemoveFromFavorites={removeFromFavourites}
                        favorites={favourites}
                        onAddToFavorites={addToFavourites}
                        onPlay={(src: string, index: number, favorite: boolean) => {playSubmission(src, index, favorite)}}
                        voteFor={voteFor}
                        listenedRatio={listenedRatio}
                        finalVote={finalVote}
                        />
          <div className="audio-player-title">Submissions</div>
            <div style={{ display: 'flex', flexDirection: 'row', gap: '10px', flexWrap: 'wrap' }}>
              {regularSubmissions.map((track, index) => (
                <SubmissionItem 
                    key={index}
                    src={track}
                    index={index}
                    isCurrentTrack={state.player1.source == track}
                    isPlaying={state.player1.isPlaying}
                    listened={listened.includes(track)}
                    favorite={favourites.includes(track)}
                    onAddToFavorites={addToFavourites}
                    onPlay={(src: string, index: number, favorite: boolean) =>
                        {playSubmission(src, index, favorite)}}
                    voteFor={voteFor}
                    listenedRatio={listenedRatio}
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