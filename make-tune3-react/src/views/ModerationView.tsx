import { useContext, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAppStore } from '../stores/appStore';
import { AudioEngineContext } from '../audio-services/AudioEngineContext';
import { ModerationSubmissionItem } from '../components/ModerationSubmissionItem';
import { Mixer } from '../components/Mixer';
import { ModerationPanel } from '../components/ModerationPanel';
import { CollabData } from '../components/CollabData';
import { CollabHeader } from '../components/CollabHeader';
import ProjectHistory from '../components/ProjectHistory';
import { LoadingSpinner } from '../components/LoadingSpinner';
import styles from './ModerationView.module.css';

export function ModerationView() {
  const audioContext = useContext(AudioEngineContext);
  const { user } = useAppStore(state => state.auth);
  const {
    regularTracks,
    currentCollaboration,
    loadCollaborationForModeration,
    approveSubmission,
    rejectSubmission,
    isLoadingCollaboration
  } = useAppStore(state => state.collaboration);
  const { playSubmission } = useAppStore(state => state.playback);
  const { currentProject } = useAppStore(state => state.collaboration);

  const collabId = useParams().collaborationId as string;
  const navigate = useNavigate();

  useEffect(() => {
    if (!collabId || !user) return;
    loadCollaborationForModeration(collabId);
  }, [collabId, user, loadCollaborationForModeration]);

  if (!audioContext) return null;
  const { state } = audioContext;
  useEffect(() => {
    const backingPath = useAppStore.getState().collaboration.currentCollaboration?.backingTrackPath;
    if (!backingPath) return;
    // If already resolved elsewhere to full URL, we could resolve here; otherwise, rely on submission view logic.
  }, []);

  const pendingTracks = regularTracks.filter(track => track.moderationStatus === 'pending');
  const isModerationLoading = isLoadingCollaboration || !currentCollaboration || currentCollaboration.id !== collabId;
  const timelineStatus = currentCollaboration?.id === collabId ? currentCollaboration.status : 'submission';

  return (
    <div className={`view-container ${styles.container}`}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.headerRow}>
            <button
              className={`btn-ghost ${styles.backButton}`}
              onClick={() => navigate('/collabs')}
            >
              ← Back to collabs
            </button>
            <span className={styles.sectionLabel}>Moderation Queue</span>
          </div>
          <div className={styles.headerCol}>
            <div className={styles.title}>{currentProject?.name || ''}</div>
            <div className={styles.subtitle}>{currentProject?.description || ''}</div>
          </div>
          <div className={styles.headerCol}>
            <div className={styles.title}>{currentCollaboration?.name || ''}</div>
            <div className={styles.subtitle}>{currentCollaboration?.description || ''}</div>
          </div>
        </div>
        <div className={styles.headerRight}>
          <ProjectHistory />
          <CollabData collab={currentCollaboration as any} />
          <CollabHeader collaboration={currentCollaboration} displayStatus={timelineStatus} />
        </div>
      </div>

      <div className={styles.content}>
        <div className={`${styles.submissionsSection} ${!state.playerController.pastStagePlayback ? styles.activePlayback : ''}`}>
          <div className={styles.audioPlayerSection}>
            {isModerationLoading ? (
              <div className={styles.loadingState}>
                <LoadingSpinner size={36} />
                <div className={styles.loadingText}>Loading moderation queue…</div>
              </div>
            ) : (
              <>
                <ModerationPanel
                  tracks={pendingTracks}
                  onApprove={(track) => approveSubmission?.(track)}
                  onReject={(track) => rejectSubmission?.(track)}
                />
                <div className={styles.audioPlayerTitle}>Submissions</div>
                {regularTracks.length === 0 ? (
                  <div className={styles.emptyState}>
                    No pending submissions to moderate.
                  </div>
                ) : (
                  <div className={`${styles.submissionsScroll} themed-scroll`}>
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
                )}
              </>
            )}
          </div>
        </div>

        <div className={`mixer-theme ${styles.mixerSection}`}>
          <Mixer state={state} />
        </div>
      </div>
    </div>
  );
}
