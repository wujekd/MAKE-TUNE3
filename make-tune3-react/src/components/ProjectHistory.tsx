import React, { useContext } from 'react';
import { AudioEngineContext } from '../audio-services/AudioEngineContext';
import { usePlayerController } from '../hooks/usePlayerController';
import { useCollabData } from '../hooks/useCollabData';
import './ProjectHistory.css';

const ProjectHistory = () => {
  const audioContext = useContext(AudioEngineContext);
  
  if (!audioContext) {
    return <div>Loading audio engine...</div>;
  }
  
  const { engine } = audioContext;
  const controller = usePlayerController(engine);
  const collabData = useCollabData();

  return (
    <div className="project-history">
      <h4 className="project-history-title">Collab History</h4>
      <div className="collab-list">
        {collabData.pastStageTracklist.map((track, index) => (
          <div 
            key={index}
            className="collab-history-item"
            onClick={() => controller.playPastSubmission(index)}
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