import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../stores/appStore';
import { useUIStore } from '../stores/useUIStore';
import styles from '../views/DashboardView.module.css';

interface DashboardHeaderProps {
  totalCollabs: number;
  filteredCount: number;
  pendingModeration: number;
  totalSubmissions: number;
  totalVotes: number;
  activeCollabs: number;
}

export function DashboardHeader({
  totalCollabs,
  filteredCount,
  pendingModeration,
  totalSubmissions,
  totalVotes,
  activeCollabs
}: DashboardHeaderProps) {
  const navigate = useNavigate();
  const { user } = useAppStore(state => state.auth);
  const { openFeedbackModal } = useUIStore();

  return (
    <div className={styles.hero}>
      <div className={styles.heroHeader}>
        <div className={styles.heroIntro}>
          <div className={styles.heroLabel}>dashboard</div>
          <div className={styles.heroDescription}>
            here ill make some kinda collab recommendations based on user and collab tags i think...
          </div>
          <button
            className={styles.feedbackCta}
            onClick={() => {
              if (user) {
                openFeedbackModal();
              } else {
                navigate('/auth');
              }
            }}
          >
            {user ? 'Send Feedback' : 'Login to Send Feedback'}
          </button>
        </div>
        <div className={styles.heroActions}>
          <div className={styles.counterGrid}>
            <CounterCard value={totalCollabs} label="collabs" />
            <CounterCard value={activeCollabs} label="active" />
            <CounterCard value={filteredCount} label="visible" />
            <CounterCard value={totalSubmissions} label="submissions" />
            <CounterCard value={totalVotes} label="votes" />
            <CounterCard value={pendingModeration} label="pending" highlight={pendingModeration > 0} />
          </div>
        </div>
      </div>
    </div>
  );
}

interface CounterCardProps {
  value: number;
  label: string;
  highlight?: boolean;
}

function CounterCard({ value, label, highlight }: CounterCardProps) {
  const cardClass = highlight
    ? `${styles.counterCard} ${styles['counterCard--highlight']}`
    : styles.counterCard;

  return (
    <div className={cardClass}>
      <div className={styles.counterValue}>{value}</div>
      <div className={styles.counterLabel}>{label}</div>
    </div>
  );
}

