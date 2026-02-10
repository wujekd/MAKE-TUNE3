import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../stores/appStore';
import { useUIStore } from '../stores/useUIStore';
import styles from '../views/DashboardView.module.css';

interface DashboardHeaderProps {
  totalCollabs: number;
  totalSubmissions: number;
  totalVotes: number;
  activeCollabs: number;
}

const compactFormatter = new Intl.NumberFormat('en', {
  notation: 'compact',
  maximumFractionDigits: 1
});

const formatCount = (value: number) => {
  if (!Number.isFinite(value)) return '0';
  return Math.abs(value) >= 10000 ? compactFormatter.format(value) : String(value);
};

export function DashboardHeader({
  totalCollabs,
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
          <div className={styles.counterWrap}>
            <div className={styles.counterGrid}>
              <CounterCard value={totalCollabs} label="collabs" />
              <CounterCard value={activeCollabs} label="active" />
              <CounterCard value={totalSubmissions} label="submissions" />
              <CounterCard value={totalVotes} label="votes" />
            </div>
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
      <div className={styles.counterHeader}>
        <div className={styles.counterLabel}>{label}</div>
        <div className={styles.counterValue}>{formatCount(value)}</div>
      </div>
    </div>
  );
}
