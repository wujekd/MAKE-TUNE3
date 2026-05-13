import './DashboardPlaceholderItem.css';
import './StageStatusProgress.css';

type DashboardPlaceholderVariant = 'activity' | 'collaboration';

interface DashboardPlaceholderItemProps {
  variant?: DashboardPlaceholderVariant;
  metaLineCount?: number;
  tagCount?: number;
  showProgress?: boolean;
  showAction?: boolean;
  className?: string;
}

const merge = (...values: Array<string | false | null | undefined>) =>
  values.filter(Boolean).join(' ');

function ActivityPlaceholder({
  metaLineCount,
  showProgress,
  showAction,
  className
}: Omit<DashboardPlaceholderItemProps, 'variant' | 'tagCount'>) {
  const resolvedMetaLineCount = metaLineCount ?? 3;

  return (
    <div
      aria-hidden="true"
      className={merge('user-activity-list-item', 'dashboard-placeholder-item', className)}
    >
      <div className="user-activity-list-item__body">
        <div className="user-activity-list-item__header">
          <span className="user-activity-list-item__title dashboard-placeholder-item__bar dashboard-placeholder-item__bar--activity-title" />
        </div>

        <span className="user-activity-list-item__subtitle dashboard-placeholder-item__bar dashboard-placeholder-item__bar--activity-subtitle" />

        <div className="user-activity-list-item__timeline-row">
          <span className="collab-status-label stage-status-progress user-activity-list-item__timeline-progress dashboard-placeholder-item__status-progress">
            <span className="stage-status-progress__fill dashboard-placeholder-item__merged-progress-fill" />
            <span className="stage-status-progress__text dashboard-placeholder-item__bar dashboard-placeholder-item__bar--merged-status" />
            <span className="stage-status-progress__percent dashboard-placeholder-item__bar dashboard-placeholder-item__bar--merged-percent" />
          </span>
          <span className="user-activity-list-item__deadline-pill dashboard-placeholder-item__deadline-pill">
            <span className="dashboard-placeholder-item__bar dashboard-placeholder-item__bar--deadline" />
          </span>
        </div>

        <div className="user-activity-list-item__submission-row">
          <span className="user-activity-list-item__submission-pill dashboard-placeholder-item__submission-pill">
            <span className="dashboard-placeholder-item__bar dashboard-placeholder-item__bar--submission" />
          </span>
        </div>

        <div className="user-activity-list-item__meta-column">
          {Array.from({ length: resolvedMetaLineCount }, (_, index) => (
            <span
              key={index}
              className={merge(
                'user-activity-list-item__meta',
                'dashboard-placeholder-item__bar',
                'dashboard-placeholder-item__bar--meta',
                index === resolvedMetaLineCount - 1 && 'dashboard-placeholder-item__bar--meta-short'
              )}
            />
          ))}
        </div>
      </div>

      {showAction && (
        <span className="user-activity-list-item__action dashboard-placeholder-item__bar dashboard-placeholder-item__bar--activity-action" />
      )}
    </div>
  );
}

function CollaborationPlaceholder({
  metaLineCount,
  showProgress,
  showAction,
  className
}: Omit<DashboardPlaceholderItemProps, 'variant'>) {
  const resolvedMetaLineCount = metaLineCount ?? 1;

  return (
    <div
      aria-hidden="true"
      className={merge('collab-history-item', 'list__item', 'dashboard-placeholder-item', className)}
    >
      <div className="collab-list-item__main">
        <div className="collab-list-item__header">
          <div className="collab-list-item__title-block">
            <span className="collab-list-item__title dashboard-placeholder-item__bar dashboard-placeholder-item__bar--collab-title" />
          </div>
          <div className="collab-status-label stage-status-progress collab-list-item__status-progress dashboard-placeholder-item__status-progress">
            <span className="stage-status-progress__fill dashboard-placeholder-item__merged-progress-fill" />
            <span className="stage-status-progress__text dashboard-placeholder-item__bar dashboard-placeholder-item__bar--merged-status" />
            {showProgress && (
              <span className="stage-status-progress__percent dashboard-placeholder-item__bar dashboard-placeholder-item__bar--merged-percent" />
            )}
          </div>
        </div>

        <div className="dashboard-placeholder-item__collab-meta-row">
          {resolvedMetaLineCount > 0 && (
            <div className="dashboard-placeholder-item__inline-meta">
              {Array.from({ length: resolvedMetaLineCount }, (_, index) => (
                <span
                  key={index}
                  className={merge(
                    'dashboard-placeholder-item__bar',
                    'dashboard-placeholder-item__bar--stage-label',
                    index === resolvedMetaLineCount - 1 && 'dashboard-placeholder-item__bar--stage-label-short'
                  )}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {showAction && (
        <div className="collab-list-item__audio-row">
          <div className="collab-list-item__right">
            <span className="list-play-button disabled dashboard-placeholder-item__button-shell" />
          </div>
          <div className="collab-list-item__footer dashboard-placeholder-item__waveform-shell">
            <span className="dashboard-placeholder-item__waveform-line" />
          </div>
        </div>
      )}
    </div>
  );
}

export function DashboardPlaceholderItem({
  variant = 'activity',
  metaLineCount,
  tagCount,
  showProgress = true,
  showAction = true,
  className
}: DashboardPlaceholderItemProps) {
  if (variant === 'collaboration') {
    return (
      <CollaborationPlaceholder
        metaLineCount={metaLineCount}
        tagCount={tagCount}
        showProgress={showProgress}
        showAction={showAction}
        className={className}
      />
    );
  }

  return (
    <ActivityPlaceholder
      metaLineCount={metaLineCount}
      showProgress={showProgress}
      showAction={showAction}
      className={className}
    />
  );
}
