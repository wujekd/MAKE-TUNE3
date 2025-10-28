import './CollabProgressBar.css';

interface CollabProgressBarProps {
  progress: number;  /** Progress value from 0 to 100 */
}

export function CollabProgressBar({ progress }: CollabProgressBarProps) {
  const normalizedProgress = Math.min(100, Math.max(0, progress));   // Ensure progress is between 0 and 100
  
  // Calculate widths - submission should stay at 50% when in voting phase
  const submissionWidth = normalizedProgress <= 50 ? normalizedProgress * 2 : 100;
  const votingWidth = normalizedProgress > 50 ? (normalizedProgress - 50) * 2 : 0;
  
  // Handle position should be at the end of the filled bar
  // In submission: at the end of the green bar (0-50% of total bar)
  // In voting: at 50% + the voting bar width (50-100% of total bar)
  let visualPosition: number;
  if (normalizedProgress <= 50) {
    // In submission: handle position matches the green bar width
    visualPosition = submissionWidth / 2; // submissionWidth is 0-100, so divide by 2 to get 0-50
  } else {
    // In voting: handle is at 50% (end of submission) + the full voting width
    visualPosition = 50 + votingWidth;
  }
  const handlePosition = `${visualPosition}%`;
  
  console.log('CollabProgressBar:', {
    progress,
    normalizedProgress,
    submissionWidth,
    votingWidth,
    visualPosition,
    handlePosition
  });
  
  return (
    <div className="collab-progress">
      <div className="collab-progress__bar">
        <div className="collab-progress__track">
          {/* Submission half - stays at 50% when voting starts */}
          <div 
            className="collab-progress__fill collab-progress__fill--submission"
            style={{ width: normalizedProgress <= 50 ? `${submissionWidth}%` : '50%' }}
          />
          {/* Voting half - starts from 50% mark */}
          <div 
            className="collab-progress__fill collab-progress__fill--voting"
            style={{ 
              width: `${votingWidth}%`
            }}
          />
          {/* Center divider */}
          <div className="collab-progress__divider" />
          {/* Handle/dot */}
          <div 
            className="collab-progress__handle"
            style={{ left: handlePosition }}
          />
        </div>
        <div className="collab-progress__labels">
          <span>Submission</span>
          <span>Voting</span>
        </div>
      </div>
    </div>
  );
}