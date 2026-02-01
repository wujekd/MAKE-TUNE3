import { useContext, useEffect } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { useAppStore } from '../stores/appStore';
import { AudioEngineContext } from '../audio-services/AudioEngineContext';
import { ModerationSubmissionItem } from '../components/ModerationSubmissionItem';
import { Mixer } from '../components/Mixer';
import { ModerationPanel } from '../components/ModerationPanel';
import { CollabData } from '../components/CollabData';
import { CollabHeader } from '../components/CollabHeader';
import './MainView.css';
import { usePrefetchAudio } from '../hooks/usePrefetchAudio';

export function ModerationView() {
  const audioContext = useContext(AudioEngineContext);
  const { user } = useAppStore(state => state.auth);
  const {
    regularTracks,
    currentCollaboration,
    loadCollaborationForModeration,
    approveSubmission,
    rejectSubmission
  } = useAppStore(state => state.collaboration);
  const { playSubmission } = useAppStore(state => state.playback);

  const location = useLocation();
  const collabId = useParams().collaborationId as string;

  useEffect(() => {
    if (!collabId || !user) return;
    loadCollaborationForModeration(collabId);
  }, [collabId, user, loadCollaborationForModeration]);

  if (!audioContext) return null;
  const { engine, state } = audioContext;
  useEffect(() => {
    const backingPath = useAppStore.getState().collaboration.currentCollaboration?.backingTrackPath;
    if (!backingPath) return;
    // If already resolved elsewhere to full URL, we could resolve here; otherwise, rely on submission view logic.
  }, []);

  const pendingTracks = regularTracks.filter(track => track.moderationStatus === 'pending');

  return (
    <div className="main-container">
      <div style={{ position: 'absolute', top: 16, left: 16, zIndex: 1000 }}>
        <button onClick={() => (window.location.href = '/collabs')} style={{ padding: '8px 12px' }}>← back to collabs</button>
      </div>

      <div className="info-top">
        <h2>Moderation</h2>
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
          <CollabData collab={currentCollaboration as any} />
          <CollabHeader collaboration={currentCollaboration} />
        </div>
      </div>

      <div className={`submissions-section ${!state.playerController.pastStagePlayback ? 'active-playback' : ''}`}>
        <div className="audio-player-section">
          <ModerationPanel
            tracks={pendingTracks}
            onApprove={(track) => approveSubmission?.(track)}
            onReject={(track) => rejectSubmission?.(track)}
          />
          <div className="audio-player-title">Submissions</div>
          <div style={{ display: 'flex', flexDirection: 'row', gap: '10px', flexWrap: 'wrap' }}>
            {regularTracks.map((track, index) => {
              const isCurrent =
                !state.playerController.pastStagePlayback &&
                !state.playerController.playingFavourite &&
                state.playerController.currentTrackId === index;

              return (
                <ModerationSubmissionItem
                  key={track.id}
                  track={track}
                  index={index}
                  isCurrentTrack={isCurrent}
                  isPlaying={isCurrent && state.player1.isPlaying}
                  onPlay={(filePath, ix) => playSubmission(filePath, ix, false)}
                />
              );
            })}
          </div>
        </div>
      </div>
      <Mixer state={state} />
    </div>
  );
}
