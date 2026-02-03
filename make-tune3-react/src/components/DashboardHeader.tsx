import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../stores/appStore';
import { useUIStore } from '../stores/useUIStore';
import styles from '../views/DashboardView.module.css';

interface DashboardHeaderProps {
  totalCollabs: number;
  filteredCount: number;
  pendingModeration: number;
}

export function DashboardHeader({ totalCollabs, filteredCount, pendingModeration }: DashboardHeaderProps) {
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
          {user && (
            <button
              className={styles.feedbackCta}
              onClick={() => openFeedbackModal()}
            >
              Send Feedback
            </button>
          )}
        </div>
        <div className={styles.heroActions}>
          {user?.isAdmin && (
            <button
              className={styles.adminButton}
              onClick={() => navigate('/admin/feedback')}
            >
              Admin Panel
            </button>
          )}
          <div className={styles.stats}>
            <StatCard value={totalCollabs} label="total collabs" />
            <StatCard value={filteredCount} label="visible" />
            <StatCard value={pendingModeration} label="pending mod" />
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ value, label }: { value: number; label: string }) {
  return (
    <div className={styles.statCard}>
      <div className={styles.statValue}>{value}</div>
      <div className={styles.statLabel}>{label}</div>
    </div>
  );
}

