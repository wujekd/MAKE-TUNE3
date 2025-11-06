import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ItemStageProgressBar } from './ItemStageProgressBar';
import { CollabStatusLabel } from './CollabStatusLabel';
import './ProjectListItem.css';

type StageInfo = {
  status: string;
  label?: string;
  startAt?: number | null;
  endAt?: number | null;
};

interface ProjectListItemProps {
  projectName: string;
  to?: string;
  onClick?: () => void;
  description?: string | null;
  createdLabel?: string;
  currentCollabName?: string | null;
  stageInfo?: StageInfo | null;
  footerLabel?: ReactNode;
}

export function ProjectListItem({
  projectName,
  to,
  onClick,
  description,
  createdLabel,
  currentCollabName,
  stageInfo,
  footerLabel = 'manage'
}: ProjectListItemProps) {

  const content = (
    <>
      <div className="project-list-item__header">
        <div className="project-list-item__title-block">
          <span className="project-list-item__title">{projectName}</span>
          {createdLabel ? <span className="project-list-item__meta">{createdLabel}</span> : null}
        </div>
        {footerLabel ? (
          <span className="project-list-item__manage" aria-hidden="true">
            {footerLabel}
          </span>
        ) : null}
      </div>

      {description ? (
        <p className="project-list-item__description">{description}</p>
      ) : null}

      <div className="project-list-item__status">
        <div className="project-list-item__status-header">
          <span className="project-list-item__status-heading">last collab state</span>
          {currentCollabName ? (
            <span className="project-list-item__status-name">{currentCollabName}</span>
          ) : null}
        </div>

        {stageInfo ? (
          <>
            <div className="project-list-item__stage-row">
              <CollabStatusLabel status={stageInfo.status} />
              {stageInfo.label ? (
                <span className="project-list-item__stage-label">{stageInfo.label}</span>
              ) : null}
            </div>
            <ItemStageProgressBar
              status={stageInfo.status}
              startAt={stageInfo.startAt}
              endAt={stageInfo.endAt}
            />
          </>
        ) : (
          <div className="project-list-item__empty-state">no active collaboration</div>
        )}
      </div>
    </>
  );

  if (to) {
    return (
      <Link to={to} className="project-list-item">
        {content}
      </Link>
    );
  }

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className="project-list-item project-list-item--button">
        {content}
      </button>
    );
  }

  return <div className="project-list-item">{content}</div>;
}
