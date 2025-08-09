import { useRef, useEffect, useContext } from 'react';
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

  // const votedFor = null;
  // const isSubmittingVote = false;

  const handleRemoveFromFavorites = (track: Track) => {
    console.log('Remove from favorites:', track);
    onRemoveFromFavorites(track.filePath);
  };

  // const onVote = (track: Track) => {
  //   console.log('Vote for favorite:', track.filePath);
  //   voteFor(track.filePath);
  // };

  const audioContext = useContext(AudioEngineContext);

  if (!audioContext) {
    return <div>Loading audio engine...</div>;
  }
  const { state } = audioContext;

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
  
  const finalIndex = finalVote ? favorites.findIndex(t => t.filePath === finalVote) : -1;
  const hasFinal = finalIndex >= 0;

  return (
    <section className="favorites-section">
      <div className="favorites-header">
        <h2 className="favorites-title">Favorites</h2>
        {!finalVote && favorites.length > 0 && (
          <span className="vote-warning">Please select your final vote!</span>
        )}
      </div>
      
      <div 
        className="favorites-container" 
        ref={scrollContainerRef}
      >
        {/* Final vote placeholder slot at the beginning */}
        <div className="favorite-item favorite-placeholder" style={{ outline: '1px dashed rgba(255,255,255,0.2)' }}>
          {hasFinal ? (
            <SubmissionItem
              key={favorites[finalIndex].id}
              track={favorites[finalIndex]}
              index={finalIndex}
              isCurrentTrack={
                !state.playerController.pastStagePlayback &&
                state.playerController.playingFavourite &&
                state.playerController.currentTrackId === finalIndex
              }
              isPlaying={state.player1.isPlaying}
              listened={true}
              favorite={true}
              onAddToFavorites={() => onAddToFavorites(favorites[finalIndex].filePath)}
              onPlay={(_trackId, _index) => onPlay(favorites[finalIndex].filePath, finalIndex, true)}
              voteFor={voteFor}
              listenedRatio={listenedRatio}
              isFinal={true}
            />
          ) : (
            <div style={{ color: 'var(--white)', opacity: 0.7, padding: 8 }}>final vote placeholder</div>
          )}
        </div>

        {/* Render remaining favorites excluding the final vote item */}
        {favorites && favorites.length > 0 ? (
          favorites.map((track, index) => {
            if (index === finalIndex) return null;
            return (
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
                  isCurrentTrack={
                    !state.playerController.pastStagePlayback &&
                    state.playerController.playingFavourite &&
                    state.playerController.currentTrackId === index
                  }
                  isPlaying={state.player1.isPlaying}
                  listened={true}
                  favorite={true}
                  onAddToFavorites={() => onAddToFavorites(track.filePath)}
                  onPlay={(_trackId) => onPlay(track.filePath, index, true)}
                  voteFor={voteFor}
                  listenedRatio={listenedRatio}
                  isFinal={false}
                />
              </div>
            );
          })
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