import { useMemo, useCallback } from 'react';
import { useAppStore } from '../stores/appStore';
import { useAudioStore } from '../stores';
import './ProjectHistory.css';

const EMPTY_ARRAY: any[] = [];

const ProjectHistory = () => {
  const pastStageTracks = useAppStore(state => state.collaboration.pastStageTracks);
  const pastCollaborations = useAppStore(
    state => state.collaboration.currentProject?.pastCollaborations ?? EMPTY_ARRAY
  );
  const playPastTrack = useCallback(
    (index: number) => {
      const play = useAppStore.getState().playback.playPastSubmission;
      play(index);
    },
    []
  );
  const { state: audioState } = useAudioStore();

  const isPastStageActive = audioState?.playerController.pastStagePlayback || false;
  const currentTrackIndex = audioState?.playerController.currentTrackId || 0;
  const isCurrentlyPlaying = audioState?.player2.isPlaying || false;

  const trackIndexByPath = useMemo(() => {
    const entries = new Map<string, number>();
    pastStageTracks.forEach((track, index) => {
      if (track?.filePath) {
        entries.set(track.filePath, index);
      }
    });
    return entries;
  }, [pastStageTracks]);

  const formatDate = (value: any) => {
    if (!value) return '';
    try {
      const date = typeof value.toMillis === 'function' ? new Date(value.toMillis()) : new Date(value);
      if (Number.isNaN(date.getTime())) return '';
      return date.toLocaleDateString();
    } catch {
      return '';
    }
  };

  const formatVotes = (winnerVotes?: number, totalVotes?: number) => {
    const winner = typeof winnerVotes === 'number' ? winnerVotes : 0;
    const total = typeof totalVotes === 'number' ? totalVotes : 0;
    if (total === 0) {
      return 'no votes';
    }
    return `${winner}/${total} votes`;
  };

  return (
    <div className={`project-history ${isPastStageActive ? 'active-playback' : ''}`}>
      <h4 className="project-history-title">Collab History</h4>
      <div className="collab-list">
        {pastCollaborations.length === 0 && (
          <div className="collab-history-item">
            <div className="collab-info">
              <span className="collab-name">No past collaborations yet</span>
            </div>
          </div>
        )}
        {pastCollaborations.map((collab) => {
          const playablePath = collab.winnerTrackPath || collab.pastStageTrackPath || collab.backingTrackPath || '';
          const trackIndex = playablePath ? trackIndexByPath.get(playablePath) ?? null : null;
          const isActive = isPastStageActive && trackIndex !== null && trackIndex === currentTrackIndex && isCurrentlyPlaying;
          const winnerName = collab.winnerUserName || 'no name';
          const completedOn = formatDate(collab.completedAt);
          const voteSummary = formatVotes(collab.winnerVotes, collab.totalVotes);
          const submissionClosed = formatDate(collab.submissionCloseAt);
          const votingClosed = formatDate(collab.votingCloseAt);
          const stageSummary = [
            submissionClosed ? `submission closed ${submissionClosed}` : '',
            votingClosed ? `voting closed ${votingClosed}` : ''
          ].filter(Boolean).join(' • ');
          const participants = typeof collab.participationCount === 'number'
            ? `${collab.participationCount} participant${collab.participationCount === 1 ? '' : 's'}`
            : '';

          return (
            <div
              key={collab.collaborationId}
              className={`collab-history-item ${isActive ? 'currently-playing' : ''}`}
              onClick={() => {
                if (trackIndex !== null && trackIndex !== undefined) {
                  playPastTrack(trackIndex);
                }
              }}
              style={{ cursor: trackIndex !== null && trackIndex !== undefined ? 'pointer' : 'default' }}
            >
              <div className="collab-status-indicator">{trackIndex !== null && trackIndex !== undefined ? '●' : '○'}</div>
              <div className="collab-info">
                <span className="collab-name">{collab.name}</span>
                <span className="collab-stage">
                  winner: {winnerName} • {voteSummary}
                </span>
                {participants && (
                  <span className="collab-stage">
                    {participants}
                  </span>
                )}
                {completedOn && (
                  <span className="collab-stage">
                    completed {completedOn}
                  </span>
                )}
                {stageSummary && (
                  <span className="collab-stage">
                    {stageSummary}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
export default ProjectHistory; 
