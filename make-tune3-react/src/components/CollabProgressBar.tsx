import './CollabProgressBar.css';

interface CollabProgressBarProps {
  progress: number;  /** Progress value from 0 to 100 */
}

export function CollabProgressBar({ progress }: CollabProgressBarProps) {
  const normalizedProgress = Math.min(100, Math.max(0, progress));   // Ensure progress is between 0 and 100
  
  return (
    <div className="collab-progress">
      <div className="collab-progress__bar">
        <div className="collab-progress__track">
          {/* Submission half */}
          <div 
            className="collab-progress__fill collab-progress__fill--submission"
            style={{ width: `${normalizedProgress <= 50 ? normalizedProgress * 2 : 100}%` }}
          />
          {/* Voting half */}
          <div 
            className="collab-progress__fill collab-progress__fill--voting"
            style={{ 
              width: `${normalizedProgress > 50 ? (normalizedProgress - 50) * 2 : 0}%`,
              left: '50%'
            }}
          />
          {/* Center divider */}
          <div className="collab-progress__divider" />
        </div>
      </div>
    </div>
  );
}