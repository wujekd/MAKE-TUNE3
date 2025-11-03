import { useState, useEffect } from 'react';
import { LoadingSpinner } from './LoadingSpinner';
import './ListPlayButton.css';

interface ListPlayButtonProps {
  isPlaying: boolean;
  isCurrentTrack: boolean;
  onPlay: () => void;
  disabled?: boolean;
  label?: string;
}

export function ListPlayButton({ 
  isPlaying, 
  isCurrentTrack, 
  onPlay, 
  disabled = false,
  label
}: ListPlayButtonProps) {
  const [isLoading, setIsLoading] = useState(false);

  // Reset loading state when track starts playing
  useEffect(() => {
    if (isCurrentTrack && isPlaying) {
      setIsLoading(false);
    }
  }, [isCurrentTrack, isPlaying]);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (disabled) return;

    // If it's not the current track, show loading while it loads
    if (!isCurrentTrack) {
      setIsLoading(true);
    }
    
    onPlay();
  };

  const getIcon = () => {
    if (isLoading) {
      return <LoadingSpinner size={14} />;
    }
    
    if (isCurrentTrack && isPlaying) {
      return '❚❚'; // Pause icon
    }
    
    return '▶'; // Play icon
  };

  const getAriaLabel = () => {
    if (isLoading) return 'loading';
    if (isCurrentTrack && isPlaying) return 'pause';
    if (isCurrentTrack && !isPlaying) return 'resume';
    return 'play';
  };

  return (
    <button
      type="button"
      className={`list-play-button ${isCurrentTrack ? 'active' : ''} ${disabled ? 'disabled' : ''} ${label ? 'with-label' : ''}`}
      onClick={handleClick}
      disabled={disabled}
      aria-label={getAriaLabel()}
    >
      {label && <span className="list-play-button__label">{label}</span>}
      <span className="list-play-button__icon">{getIcon()}</span>
    </button>
  );
}

