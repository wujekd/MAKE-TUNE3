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

function ThumbIcon() {
  return (
    <svg
      className="collaboration-preference-button__icon collaboration-preference-button__icon--thumb"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path d="M7.5 21H4.25a1.25 1.25 0 0 1-1.25-1.25v-8.5A1.25 1.25 0 0 1 4.25 10H7.5v11Z" />
      <path d="M7.5 10.25 12 3.5c.62-.92 2.05-.58 2.18.52l.1.85c.17 1.44-.08 2.9-.73 4.2l-.47.93h5.13c1.38 0 2.39 1.3 2.06 2.64l-1.44 5.75A3.4 3.4 0 0 1 15.54 21H7.5V10.25Z" />
    </svg>
  );
}

function HeartIcon() {
  return (
    <svg
      className="collaboration-preference-button__icon collaboration-preference-button__icon--heart"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path d="M12 20.5s-7.25-4.28-9.4-8.84C.9 8.06 3.05 4.5 6.68 4.5c2.07 0 3.6 1.1 4.35 2.44.77-1.34 2.3-2.44 4.37-2.44 3.63 0 5.78 3.56 4.08 7.16C19.31 16.22 12 20.5 12 20.5Z" />
    </svg>
  );
}

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
        {isUpdatingLike ? <LoadingSpinner size={12} /> : <ThumbIcon />}
      </button>
      <button
        className={`collaboration-preference-button collaboration-preference-button--strong${favorited ? ' is-active' : ''}`}
        onClick={onToggleFavorite}
        disabled={disabled || isUpdatingFavorite}
        aria-label={favorited ? 'Favorited collaboration' : 'Favorite collaboration'}
        title={favorited ? 'Favorited collaboration' : 'Favorite collaboration'}
      >
        {isUpdatingFavorite ? <LoadingSpinner size={12} /> : <HeartIcon />}
      </button>
    </div>
  );
}
