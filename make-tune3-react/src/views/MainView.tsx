import React, { useContext, useState, useEffect } from 'react';
import { AudioEngineContext } from '../audio-services/AudioEngineContext';
import { usePlayerController } from '../hooks/usePlayerController';
import { DebugInfo } from '../components/DebugInfo';
import ProjectHistory from '../components/ProjectHistory';
import { Mixer } from '../components/Mixer';
import Favorites from '../components/Favorites';
import { useCollabData } from '../hooks/useCollabData';
import { useAuth } from '../contexts/AuthContext';
import { UserDataTest } from '../components/UserDataTest';
import './MainView.css';
import SubmissionItem from '../components/SubmissionItem';

interface MainViewProps {
  onShowAuth: () => void;
}

export function MainView({ onShowAuth }: MainViewProps) {
  const audioContext = useContext(AudioEngineContext);
  const { user, signOut } = useAuth();

  console.log('MainView render - user:', user?.email, 'audioContext:', !!audioContext);

  if (!audioContext) {
    return <div>Loading audio engine...</div>;
  }
  const { engine, state } = audioContext;
  const [debug, setDebug] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const collabData = useCollabData(undefined, engine);

  useEffect(() => {
    // delay to ensure all components are properly initialized?
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 100);
    
    return () => clearTimeout(timer);
  }, [user?.uid]);
  
  const controller = usePlayerController(engine, {
    regularSubmissions: collabData.regularSubmissions,
    pastStageTracklist: collabData.pastStageTracklist,
    favourites: collabData.favourites,
    backingTrackSrc: collabData.backingTrackSrc
  });

  useEffect(() => {
    if (engine) {
        engine.setTrackListenedCallback(
          (trackSrc) => {collabData.markAsListened(trackSrc)},
          collabData.listenedRatio,
          (trackSrc) => collabData.listened.includes(trackSrc)
        );
    }
  }, [engine, collabData.listenedRatio]);

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
      <UserDataTest />
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
        onClick={() => console.log('playingFavourite:', controller.playingFavourite)}
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
        onClick={() => console.log('favourites:', collabData.favourites)}
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
            <Favorites  onRemoveFromFavorites={collabData.removeFromFavourites}
                        favorites={collabData.favourites}
                        onAddToFavorites={collabData.addToFavourites}
                        onPlay={(src: string, index: number, favorite: boolean) => {controller.playSubmission(src, index, favorite)}}
                        voteFor={collabData.voteFor}
                        listenedRatio={collabData.listenedRatio}
                        finalVote={collabData.finalVote}
                        />
          <div className="audio-player-title">Submissions</div>
            <div style={{ display: 'flex', flexDirection: 'row', gap: '10px', flexWrap: 'wrap' }}>
              {collabData.regularSubmissions.map((track, index) => (
                <SubmissionItem 
                    key={index}
                    src={track}
                    index={index}
                    isCurrentTrack={state.player1.source == track}
                    isPlaying={state.player1.isPlaying}
                    listened={collabData.listened.includes(track)}
                    favorite={collabData.favourites.includes(track)}
                    onAddToFavorites={collabData.addToFavourites}
                    onPlay={(src: string, index: number, favorite: boolean) =>
                        {controller.playSubmission(src, index, favorite)}}
                    voteFor={collabData.voteFor}
                    listenedRatio={collabData.listenedRatio}
                    isFinal={false}
                />
              ))}
            </div>
        </div>
      </div>
      <Mixer 
        engine={engine} 
        state={state} 
        controller={controller}
      />
    </div>
  );
}