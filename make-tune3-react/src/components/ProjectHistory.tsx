import React from 'react';
import { useAppStore } from '../stores/appStore';
import './ProjectHistory.css';

const ProjectHistory = () => {
  const { pastStageTracks } = useAppStore(state => state.collaboration);
  const { playPastSubmission } = useAppStore(state => state.playback);
  const { state: audioState } = useAppStore(state => state.audio);
  
  const isPastStageActive = audioState?.playerController.pastStagePlayback || false;
  const currentTrackIndex = audioState?.playerController.currentTrackId || 0;
  const isCurrentlyPlaying = audioState?.player2.isPlaying || false;

  return (
    <div className={`project-history ${isPastStageActive ? 'active-playback' : ''}`}>
      <h4 className="project-history-title">Collab History</h4>
      <div className="collab-list">
        {pastStageTracks.map((track, index) => (
          <div 
            key={track.id}
            className={`collab-history-item ${isPastStageActive && index === currentTrackIndex && isCurrentlyPlaying ? 'currently-playing' : ''}`}
            onClick={() => playPastSubmission(index)}
          >
            <div className="collab-status-indicator">○</div>
            <div className="collab-info">
              <span className="collab-name">{track.title}</span>
              <span className="collab-stage">Past Stage</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ProjectHistory; 