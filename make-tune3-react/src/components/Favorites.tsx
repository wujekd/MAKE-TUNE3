import React, { useRef, useEffect, useContext } from 'react';
import SubmissionItem from './SubmissionItem';

import { AudioEngineContext } from '../audio-services/AudioEngineContext';
import './Favorites.css';

const Favorites = ({ onRemoveFromFavorites, favorites, onAddToFavorites, onPlay, voteFor, finalVote, listenedRatio }: 
                { onRemoveFromFavorites: (index: number) => void, favorites: string[],
                  onAddToFavorites: (src: string) => void,
                  onPlay: (src: string, index: number, favorite: boolean) => void,
                  voteFor: (src: string) => void,
                  finalVote: string,
                  listenedRatio: number
                }) => {
  const votedFor = null;
  const isSubmittingVote = false;


  const handleRemoveFromFavorites = (favorite: any, index: number) => {
    console.log('Remove from favorites:', favorite);
    onRemoveFromFavorites(index);
  };

  const onVote = (favorite: any) => {
    console.log('Vote for favorite:', favorite.id);
  };

  const audioContext = useContext(AudioEngineContext);

  if (!audioContext) {
    return <div>Loading audio engine...</div>;
  }
  const { engine, state } = audioContext;


  // Reference to the favorites container
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Add wheel event listener for horizontal scrolling
  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    if (scrollContainer) {
      const handleWheel = (event: WheelEvent) => {
        // Prevent the default vertical scroll
        event.preventDefault();
        
        // Scroll horizontally instead of vertically
        scrollContainer.scrollLeft += event.deltaY;
      };
      
      // Add the event listener
      scrollContainer.addEventListener('wheel', handleWheel, { passive: false });
      
      // Clean up the event listener when component unmounts
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
          favorites.map((favorite, index) => (
            <div key={index} className="favorite-item">
              <button
                className="remove-button"
                onClick={() => handleRemoveFromFavorites(favorite, index)}
              >
                ×
              </button>
              <SubmissionItem 
                key={index}
                index={index}
                src={favorite}
                isCurrentTrack={state.player1.source == favorite}
                isPlaying={state.player1.isPlaying}
                listened={true}
                favorite={true}
                onAddToFavorites={onAddToFavorites}
                onPlay={onPlay}
                voteFor={voteFor}
                listenedRatio={listenedRatio}
                isFinal={(finalVote == favorite)}
                
              />
            </div>
          ))
        ) : (
          <div className="favorites-empty">No favorites added yet</div>
        )}
      </div>
    </section>
  );
};

export default Favorites; 