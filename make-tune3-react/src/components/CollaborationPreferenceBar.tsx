import { LoadingSpinner } from './LoadingSpinner';
import './CollaborationPreferenceBar.css';

type Props = {
  disabled?: boolean;
  liked: boolean;
  favorited: boolean;
  isUpdatingLike: boolean;
  isUpdatingFavorite: boolean;
  onToggleLike: () => void;
  onToggleFavorite: () => void;
};

export function CollaborationPreferenceBar({
  disabled = false,
  liked,
  favorited,
  isUpdatingLike,
  isUpdatingFavorite,
  onToggleLike,
  onToggleFavorite
}: Props) {
  return (
    <div className="collaboration-preference-bar" aria-label="Collaboration preferences">
      <button
        className={`collaboration-preference-button${liked ? ' is-active' : ''}`}
        onClick={onToggleLike}
        disabled={disabled || isUpdatingLike}
        aria-label={liked ? 'Liked collaboration' : 'Like collaboration'}
        title={liked ? 'Liked collaboration' : 'Like collaboration'}
      >
        {isUpdatingLike ? <LoadingSpinner size={12} /> : '👍'}
      </button>
      <button
        className={`collaboration-preference-button collaboration-preference-button--strong${favorited ? ' is-active' : ''}`}
        onClick={onToggleFavorite}
        disabled={disabled || isUpdatingFavorite}
        aria-label={favorited ? 'Favorited collaboration' : 'Favorite collaboration'}
        title={favorited ? 'Favorited collaboration' : 'Favorite collaboration'}
      >
        {isUpdatingFavorite ? <LoadingSpinner size={12} /> : '♥'}
      </button>
    </div>
  );
}
