import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../stores/appStore';
import { useUIStore } from '../stores/useUIStore';
import { CountUpValue } from './CountUpValue';
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

const dashboardSteps = [
  {
    number: '01',
    title: 'Discover',
    description: 'Filter open collaborations by tag and preview the backing track before you jump in.'
  },
  {
    number: '02',
    title: 'Submit',
    description: 'Open a live collaboration, upload your version during submissions, and keep an eye on deadlines.'
  },
  {
    number: '03',
    title: 'Vote + Track',
    description: 'Return for voting, then follow your activity and finished rounds from the dashboard.'
  }
] as const;

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
            I&apos;d appreciate your feedback on how you would like to use this website.
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
        <div className={styles.heroProcessColumn}>
          <div className={styles.heroProcess} aria-label="Dashboard collaboration flow">
            {dashboardSteps.map(step => (
              <div key={step.number} className={styles.heroProcessCard}>
                <div className={styles.heroProcessNumber}>{step.number}</div>
                <div className={styles.heroProcessContent}>
                  <div className={styles.heroProcessTitle}>{step.title}</div>
                  <div className={styles.heroProcessDescription}>{step.description}</div>
                </div>
              </div>
            ))}
          </div>
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
        <CountUpValue className={styles.counterValue} value={value} formatValue={formatCount} />
      </div>
    </div>
  );
}
