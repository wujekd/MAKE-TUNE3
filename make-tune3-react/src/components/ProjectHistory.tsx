import { useMemo, useCallback } from 'react';
import { useAppStore } from '../stores/appStore';
import { useAudioStore } from '../stores';
import type { PastCollaboration } from '../types/collaboration';
import './ProjectHistory.css';

const EMPTY_ARRAY: PastCollaboration[] = [];

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
  const audioState = useAudioStore(state => state.state);

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
    <div
      className={`project-history project-history--collab-history ${isPastStageActive ? 'project-history--active-playback active-playback' : ''}`}
    >
      <div className="project-history__header">
        <h4 className="project-history-title">Collab History</h4>
        {pastCollaborations.length > 0 && (
          <span className="project-history__count" aria-label={`${pastCollaborations.length} past collaborations`}>
            {pastCollaborations.length}
          </span>
        )}
      </div>
      <div className="project-history__list" role="list">
        {pastCollaborations.length === 0 && (
          <div className="project-history__empty" role="listitem">
            <div className="project-history__empty-title">No past collaborations yet</div>
            <div className="project-history__empty-copy">
              Finished rounds will show up here.
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
          const stageMarkers: Array<{ key: string; label: string; date: string; title: string }> = [];
          if (submissionClosed) {
            stageMarkers.push({
              key: 'submission',
              label: 'sub',
              date: submissionClosed,
              title: `submission closed ${submissionClosed}`
            });
          }
          if (votingClosed) {
            stageMarkers.push({
              key: 'voting',
              label: 'vote',
              date: votingClosed,
              title: `voting closed ${votingClosed}`
            });
          }
          const participants = typeof collab.participationCount === 'number'
            ? `${collab.participationCount} participant${collab.participationCount === 1 ? '' : 's'}`
            : '';
          const isPlayable = trackIndex !== null && trackIndex !== undefined;
          const itemSummary = [
            `winner ${winnerName}`,
            voteSummary,
            participants,
            completedOn ? `completed ${completedOn}` : '',
            ...stageMarkers.map(marker => marker.title)
          ].filter(Boolean).join(', ');

          return (
            <button
              type="button"
              key={collab.collaborationId}
              className={[
                'project-history__item',
                isPlayable ? 'project-history__item--playable' : 'project-history__item--static',
                isActive ? 'project-history__item--playing currently-playing' : ''
              ].filter(Boolean).join(' ')}
              disabled={!isPlayable}
              onClick={() => {
                if (isPlayable) {
                  playPastTrack(trackIndex);
                }
              }}
              role="listitem"
              aria-label={`${isPlayable ? 'Play' : 'Past collaboration'} ${collab.name}. ${itemSummary}`}
            >
              <span className="project-history__status-dot" aria-hidden="true" />
              <span className="project-history__body">
                <span className="project-history__topline">
                  <span className="project-history__name">{collab.name}</span>
                  {completedOn && (
                    <span className="project-history__date">{completedOn}</span>
                  )}
                </span>

                <span className="project-history__meta-row">
                  <span className="project-history__pill project-history__pill--winner">
                    winner {winnerName}
                  </span>
                  <span className="project-history__pill">{voteSummary}</span>
                  {participants && (
                    <span className="project-history__pill">{participants}</span>
                  )}
                </span>

                {stageMarkers.length > 0 && (
                  <span
                    className="project-history__stage-row"
                    aria-label={stageMarkers.map(marker => marker.title).join(', ')}
                  >
                    {stageMarkers.map(marker => (
                      <span
                        key={marker.key}
                        className={`project-history__stage-chip project-history__stage-chip--${marker.key}`}
                        title={marker.title}
                      >
                        <span>{marker.label}</span>
                        <span>{marker.date}</span>
                      </span>
                    ))}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
export default ProjectHistory; 
