import { useUIStore } from '../stores/useUIStore';
import { useAppStore } from '../stores/appStore';
import './FeedbackButton.css';

export function FeedbackButton() {
  const { user } = useAppStore(state => state.auth);
  const { openFeedbackModal } = useUIStore();

  if (!user) return null;

  return (
    <button
      className="feedback-button"
      onClick={() => openFeedbackModal()}
      title="Send Feedback"
      aria-label="Send Feedback"
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    </button>
  );
}
