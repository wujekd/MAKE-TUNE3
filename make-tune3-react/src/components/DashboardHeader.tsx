import styles from '../views/DashboardView.module.css';

interface DashboardHeaderProps {
  totalCollabs: number;
  filteredCount: number;
  pendingModeration: number;
}

export function DashboardHeader({ totalCollabs, filteredCount, pendingModeration }: DashboardHeaderProps) {
  return (
    <div className={styles.hero}>
      <div className={styles.heroHeader}>
        <div className={styles.heroIntro}>
          <div className={styles.heroLabel}>dashboard</div>
          <div className={styles.heroDescription}>
            here ill make some kinda collab recommendations based on user and collab tags i think...
          </div>
        </div>
        <div className={styles.stats}>
          <StatCard value={totalCollabs} label="total collabs" />
          <StatCard value={filteredCount} label="visible" />
          <StatCard value={pendingModeration} label="pending mod" />
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

