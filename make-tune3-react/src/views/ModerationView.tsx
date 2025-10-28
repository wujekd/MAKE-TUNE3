import { useContext, useEffect } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { useAppStore } from '../stores/appStore';
import { AudioEngineContext } from '../audio-services/AudioEngineContext';
import Favorites from '../components/Favorites';
import SubmissionItem from '../components/SubmissionItem';
import { Mixer } from '../components/Mixer';
import { ModerationPanel } from '../components/ModerationPanel';
import './MainView.css';
import { usePrefetchAudio } from '../hooks/usePrefetchAudio';

export function ModerationView() {
  const audioContext = useContext(AudioEngineContext);
  const { user } = useAppStore(state => state.auth);
  const { 
    regularTracks,
    favorites,
    loadCollaboration,
    loadCollaborationAnonymousById,
    isTrackFavorite,
    isTrackListened,
    approveSubmission,
    rejectSubmission
  } = useAppStore(state => state.collaboration);
  const { playSubmission } = useAppStore(state => state.playback);

  const location = useLocation();
  const collabId = useParams().collaborationId as string;

  useEffect(() => {
    if (!collabId) return;
    if (user) loadCollaboration(user.uid, collabId);
    else loadCollaborationAnonymousById(collabId);
  }, [collabId, user, loadCollaboration, loadCollaborationAnonymousById]);

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
            {regularTracks.map((track, index) => (
              <SubmissionItem 
                key={track.id}
                track={track}
                index={index}
                isCurrentTrack={
                  !state.playerController.pastStagePlayback &&
                  state.player1.source === `/test-audio/${track.filePath}`
                }
                isPlaying={state.player1.isPlaying}
                listened={isTrackListened(track.filePath)}
                favorite={isTrackFavorite(track.filePath)}
                onAddToFavorites={() => {}}
                onPlay={(filePath, ix) => playSubmission(filePath, ix, false)}
                voteFor={() => {}}
                listenedRatio={7}
                isFinal={false}
              />
            ))}
          </div>
        </div>
      </div>
      <Mixer state={state} />
    </div>
  );
}
