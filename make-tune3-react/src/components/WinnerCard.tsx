import type { ReactNode } from 'react';
import { LoadingSpinner } from './LoadingSpinner';

type WinnerCardProps = {
  name: ReactNode;
  progressPercent?: number;
  isPlaying?: boolean;
  isLoading?: boolean;
  disabled?: boolean;
  onPlay: () => void;
};

export function WinnerCard({
  name,
  progressPercent,
  isPlaying,
  isLoading,
  disabled,
  onPlay
}: WinnerCardProps) {
  const progressStyle =
    typeof progressPercent === 'number'
      ? { width: `${Math.max(0, Math.min(progressPercent, 100))}%` }
      : undefined;

  return (
    <div className="winner-card__inner">
      <div className="winner-card__title">Winner</div>
      <div className="winner-card__name">{name}</div>
      <div className="winner-card__button-wrapper">
        <button
          onClick={onPlay}
          disabled={disabled}
          className="play-button winner-card__play"
          type="button"
        >
          <div className="progress-bar" style={progressStyle}></div>
          <span className="play-icon">
            {isLoading ? <LoadingSpinner size={16} /> : isPlaying ? '❚❚' : '▶'}
          </span>
        </button>
      </div>
    </div>
  );
}
