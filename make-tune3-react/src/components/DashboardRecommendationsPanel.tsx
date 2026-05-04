import { useEffect, useMemo, useState } from 'react';
import { DashboardPlaceholderItem } from './DashboardPlaceholderItem';
import { UserActivityListItem } from './UserActivityListItem';
import { useAppStore } from '../stores/appStore';
import { computeStageInfo } from '../utils/stageUtils';
import { RecommendationService } from '../services/recommendationService';
import type { DashboardRecommendationItem } from '../services/recommendationService';
import styles from '../views/DashboardView.module.css';

const loadingPlaceholders = [0, 1, 2];

const formatGeneratedAt = (value: string): string | null => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString();
};

const formatScore = (value: number): string => value.toFixed(3);

const getTrackLabel = (path: string | null): string | null => {
  if (!path) return null;
  const fileName = path.split('/').filter(Boolean).pop() || path;
  return `highlight ${fileName}`;
};

const getRecommendationRoute = (item: DashboardRecommendationItem): string => {
  const encodedId = encodeURIComponent(item.collaborationId);
  if (item.collaborationStatus === 'submission') {
    return `/collab/${encodedId}/submit`;
  }
  if (item.collaborationStatus === 'completed') {
    return `/collab/${encodedId}/completed`;
  }
  return `/collab/${encodedId}`;
};

export function DashboardRecommendationsPanel() {
  const { user, loading: authLoading } = useAppStore(state => state.auth);
  const [items, setItems] = useState<DashboardRecommendationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      setItems([]);
      setLoading(false);
      setLoaded(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setLoaded(false);
    setError(null);

    (async () => {
      try {
        const nextItems = await RecommendationService.listMyRecommendations();
        if (!cancelled) {
          setItems(nextItems);
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message || 'failed to load recommendations');
          setItems([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
          setLoaded(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authLoading, user?.uid]);

  const generatedLabel = useMemo(() => {
    const firstItem = items[0];
    if (!firstItem) {
      return 'personalized picks from your listening and submission activity';
    }

    const generatedAt = formatGeneratedAt(firstItem.generatedAt);
    if (generatedAt && firstItem.modelVersion) {
      return `updated ${generatedAt} · ${firstItem.modelVersion}`;
    }
    if (generatedAt) {
      return `updated ${generatedAt}`;
    }
    if (firstItem.modelVersion) {
      return firstItem.modelVersion;
    }
    return 'personalized picks from your listening and submission activity';
  }, [items]);

  if (authLoading || !user) {
    return null;
  }

  return (
    <div className={`project-history ${styles.historyColumn}`}>
      <h4
        id="dashboard-recommendations-heading"
        className="project-history-title"
      >
        recommended for you
      </h4>
      <p className={styles.recommendationsMeta}>{generatedLabel}</p>

      <div className={styles.recommendationsList} aria-busy={loading && !loaded}>
        {loading && !loaded && (
          <div className={`${styles.placeholderList} dashboard-placeholder-stack`}>
            {loadingPlaceholders.map(index => (
              <DashboardPlaceholderItem key={index} variant="activity" />
            ))}
          </div>
        )}

        {!loading && error && (
          <div className={styles.emptyState}>{error}</div>
        )}

        {!loading && !error && loaded && items.length === 0 && (
          <div className={styles.emptyState}>
            no recommendations yet. check back after the next refresh.
          </div>
        )}

        {!loading && !error && items.map((item) => {
          const stageInfo = computeStageInfo({
            status: item.collaborationStatus,
            submissionCloseAt: item.submissionCloseAt,
            votingCloseAt: item.votingCloseAt,
            submissionDurationMs:
              typeof item.submissionDurationSeconds === 'number'
                ? item.submissionDurationSeconds * 1000
                : null,
            votingDurationMs:
              typeof item.votingDurationSeconds === 'number'
                ? item.votingDurationSeconds * 1000
                : null,
            publishedAt: item.publishedAt,
            updatedAt: item.updatedAt,
          });

          const metaLines = [
            `rank #${item.rank} · score ${formatScore(item.score)}`,
          ];
          const trackLabel = getTrackLabel(item.highlightedTrackPath);
          if (trackLabel) {
            metaLines.push(trackLabel);
          } else if (item.collaborationDescription) {
            metaLines.push(item.collaborationDescription);
          }

          return (
            <UserActivityListItem
              key={`${item.collaborationId}-${item.rank}`}
              title={item.collaborationName || 'untitled collaboration'}
              subtitle={item.projectName || 'unknown project'}
              status={item.collaborationStatus || 'unknown'}
              metaLines={metaLines}
              to={getRecommendationRoute(item)}
              actionLabel="open"
              stageInfo={stageInfo ? {
                status: stageInfo.status,
                startAt: stageInfo.startAt ?? null,
                endAt: stageInfo.endAt ?? null,
                label: stageInfo.label ?? undefined,
              } : null}
              className={styles.recommendationItem}
            />
          );
        })}
      </div>
    </div>
  );
}
