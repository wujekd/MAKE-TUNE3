import './DashboardPlaceholderItem.css';

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
          <span className="collab-status-label dashboard-placeholder-item__chip" />
        </div>

        <span className="user-activity-list-item__subtitle dashboard-placeholder-item__bar dashboard-placeholder-item__bar--activity-subtitle" />

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

        {showProgress && (
          <div className="user-activity-list-item__progress">
            <span className="dashboard-placeholder-item__progress-track">
              <span className="dashboard-placeholder-item__progress-fill" />
            </span>
            <span className="user-activity-list-item__progress-label dashboard-placeholder-item__bar dashboard-placeholder-item__bar--progress-label" />
          </div>
        )}
      </div>

      {showAction && (
        <span className="user-activity-list-item__action dashboard-placeholder-item__bar dashboard-placeholder-item__bar--activity-action" />
      )}
    </div>
  );
}

function CollaborationPlaceholder({
  metaLineCount,
  tagCount,
  showProgress,
  showAction,
  className
}: Omit<DashboardPlaceholderItemProps, 'variant'>) {
  const resolvedMetaLineCount = metaLineCount ?? 1;
  const resolvedTagCount = tagCount ?? 3;

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
          {showAction && (
            <div className="collab-list-item__right">
              <span className="list-play-button disabled dashboard-placeholder-item__button-shell" />
            </div>
          )}
        </div>

        <div className="dashboard-placeholder-item__tag-row">
          {Array.from({ length: resolvedTagCount }, (_, index) => (
            <span
              key={index}
              className="dashboard-placeholder-item__bar dashboard-placeholder-item__bar--tag"
            />
          ))}
        </div>

        <div className="collab-list-item__stage-row">
          <span className="collab-status-label dashboard-placeholder-item__chip" />
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

        {showProgress && (
          <span className="dashboard-placeholder-item__progress-track">
            <span className="dashboard-placeholder-item__progress-fill dashboard-placeholder-item__progress-fill--collaboration" />
          </span>
        )}
      </div>
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
