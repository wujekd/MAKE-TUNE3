import React, { useRef, useEffect } from 'react';
import SubmissionItem from './SubmissionItem';
import { useCollabData } from '../hooks/useCollabData';
import './Favorites.css';

const Favorites = () => {
  const votedFor = null;
  const isSubmittingVote = false;

  // Temporary callback functions
  const onRemoveFromFavorites = (favorite: any) => {
    console.log('Remove from favorites:', favorite.id);
  };

  const onVote = (favorite: any) => {
    console.log('Vote for favorite:', favorite.id);
  };

  const collabData = useCollabData();
  const favorites = collabData.favourites;

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
            <div key={favorite.id} className="favorite-item">
              <button
                className="remove-button"
                onClick={() => onRemoveFromFavorites(favorite)}
              >
                ×
              </button>
              <SubmissionItem 
                key={index}
                index={index}
                isPlaying={false}
                isCurrentTrack={false}
                listened={true}
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