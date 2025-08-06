import React from 'react';
import { useAppStore } from '../stores/appStore';
import './ProjectHistory.css';

const ProjectHistory = () => {
  const { pastStageTracklist, playPastSubmission } = useAppStore();

  return (
    <div className="project-history">
      <h4 className="project-history-title">Collab History</h4>
      <div className="collab-list">
        {pastStageTracklist.map((track, index) => (
          <div 
            key={index}
            className="collab-history-item"
            onClick={() => playPastSubmission(index)}
          >
            <div className="collab-status-indicator">○</div>
            <div className="collab-info">
              <span className="collab-name">{track}</span>
              <span className="collab-stage">Past Stage</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ProjectHistory; 