import React, { useRef, useEffect, useContext } from 'react';
import SubmissionItem from './SubmissionItem';
import type { Track } from '../types/collaboration';
import { AudioEngineContext } from '../audio-services/AudioEngineContext';
import './Favorites.css';

const Favorites = ({ onRemoveFromFavorites, favorites, onAddToFavorites, onPlay, voteFor, finalVote, listenedRatio }: 
                                  { onRemoveFromFavorites: (trackId: string) => void,
                    favorites: Track[],
                  onAddToFavorites: (trackId: string) => void,
                  onPlay: (trackId: string, index: number, favorite: boolean) => void,
                  voteFor: (trackId: string) => void,
                  finalVote: string | null,
                  listenedRatio: number
                }) => {
  // use favorites passed as prop

  const votedFor = null;
  const isSubmittingVote = false;

  const handleRemoveFromFavorites = (track: Track) => {
    console.log('Remove from favorites:', track);
    onRemoveFromFavorites(track.filePath);
  };

  const onVote = (track: Track) => {
    console.log('Vote for favorite:', track.filePath);
    voteFor(track.filePath);
  };

  const audioContext = useContext(AudioEngineContext);

  if (!audioContext) {
    return <div>Loading audio engine...</div>;
  }
  const { engine, state } = audioContext;

  // reference to favorites container
  const scrollContainerRef = useRef<HTMLDivElement>(null);

      // add wheel event listener for horizontal scrolling
  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    if (scrollContainer) {
      const handleWheel = (event: WheelEvent) => {
        // prevent default vertical scroll
        event.preventDefault();
        
                  // scroll horizontally instead of vertically
        scrollContainer.scrollLeft += event.deltaY;
      };
      
              // add event listener
      scrollContainer.addEventListener('wheel', handleWheel, { passive: false });
      
              // clean up event listener on unmount
      return () => {
        scrollContainer.removeEventListener('wheel', handleWheel);
      };
    }
  }, []);
  
  return (
    <section className="favorites-section">
      <div className="favorites-header">
        <h2 className="favorites-title">Favorites</h2>
        {!votedFor && favorites.length > 0 && (
          <span className="vote-warning">Please select your final vote!</span>
        )}
      </div>
      
      <div 
        className="favorites-container" 
        ref={scrollContainerRef}
      >
        {favorites && favorites.length > 0 ? (
          favorites.map((track, index) => (
            <div key={track.id} className="favorite-item">
              <button
                className="remove-button"
                onClick={() => handleRemoveFromFavorites(track)}
              >
                ×
              </button>
              <SubmissionItem 
                key={track.id}
                track={track}
                index={index}
                isCurrentTrack={!state.playerController.pastStagePlayback && state.player1.source === `/test-audio/${track.filePath}`}
                isPlaying={state.player1.isPlaying}
                listened={true}
                favorite={true}
                onAddToFavorites={() => onAddToFavorites(track.filePath)}
                onPlay={(trackId, index, favorite) => onPlay(track.filePath, index, true)}
                voteFor={voteFor}
                listenedRatio={listenedRatio}
                isFinal={finalVote === track.filePath}
              />
            </div>
          ))
        ) : (
          <div className="no-favorites">
            <p>No favorites yet</p>
            <p>Add tracks to your favorites to see them here</p>
          </div>
        )}
      </div>
    </section>
  );
};

export default Favorites; 