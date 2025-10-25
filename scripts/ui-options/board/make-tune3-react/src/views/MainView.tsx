import { useContext, useEffect, useState, useRef, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AudioEngineContext } from '../audio-services/AudioEngineContext';
import { useAppStore } from '../stores/appStore';
import './MainView.css';
import SubmissionItem from '../components/SubmissionItem';
import Favorites from '../components/Favorites';
import { Mixer } from '../components/Mixer';
// import { SubmissionEQ } from '../components/SubmissionEQ';
import ProjectHistory from '../components/ProjectHistory';
import { storage } from '../services/firebase';
import { ref, getDownloadURL } from 'firebase/storage';
import type { Collaboration } from '../types/collaboration';
import type { Timestamp } from 'firebase/firestore';

type StageKey = Collaboration['status'];

const stageCopy: Record<StageKey, { label: string; description: string }> = {
  unpublished: {
    label: 'Draft mode',
    description: 'Share a preview of the project before opening the room to collaborators.'
  },
  submission: {
    label: 'Submission window',
    description: 'Collect new stems, ideas, and iterations from the team.'
  },
  voting: {
    label: 'Voting in progress',
    description: 'Collaborators are listening and locking in their favorite takes.'
  },
  completed: {
    label: 'Collaboration wrapped',
    description: 'Celebrate the winning track and plan the next production step.'
  }
};

const sessionDrafts = [
  {
    title: "Tonight's focus",
    items: [
      'Tighten the transition into the second chorus.',
      'Capture feedback on the new vocal comp.'
    ]
  },
  {
    title: 'Next review checkpoint',
    items: [
      'Lock the finalist shortlist before Friday stand-up.',
      'Tag submissions that need mix polish or level balancing.'
    ]
  }
];

const communicationDrafts = [
  {
    title: 'Producer chat',
    body: 'A dedicated thread for realtime decisions once messaging ships.'
  },
  {
    title: 'Reference board',
    body: 'Collect inspiration tracks, lyric ideas, and arrangement notes in one glance.'
  }
];

const roadmapDrafts = [
  {
    title: 'Schedule next listening party',
    caption: 'Pick a time to review the latest shortlist together.'
  },
  {
    title: 'Prep mix checklist',
    caption: 'Document EQ, compression, and automation tasks before handoff.'
  },
  {
    title: 'Invite new collaborators',
    caption: 'Drop upcoming contributors here once invitations are confirmed.'
  }
];

const intlDateFormatter = new Intl.DateTimeFormat('en', {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit'
});

const describeDuration = (minutes: number) => {
  const safe = Math.max(1, Math.round(minutes));
  if (safe < 60) return `${safe} minute${safe === 1 ? '' : 's'}`;
  const hours = Math.round(safe / 60);
  if (hours < 48) return `${hours} hour${hours === 1 ? '' : 's'}`;
  const days = Math.round(hours / 24);
  if (days < 14) return `${days} day${days === 1 ? '' : 's'}`;
  const weeks = Math.round(days / 7);
  if (weeks < 10) return `${weeks} week${weeks === 1 ? '' : 's'}`;
  const months = Math.max(1, Math.round(days / 30));
  return `${months} month${months === 1 ? '' : 's'}`;
};

const getDeadlineInfo = (stage: StageKey, timestamp?: Timestamp | null) => {
  if (!timestamp) {
    const stageLabel = stage === 'submission'
      ? 'submission window'
      : stage === 'voting'
        ? 'voting window'
        : 'collaboration';
    return {
      summary: `No ${stageLabel} deadline yet`,
      detail: 'Add a target date to keep collaborators in sync.'
    };
  }
  const target = timestamp.toDate();
  const diff = target.getTime() - Date.now();
  const minutes = Math.abs(diff) / 60000;
  const duration = describeDuration(minutes);
  const stageLabel = stage === 'submission'
    ? 'Submission'
    : stage === 'voting'
      ? 'Voting'
      : 'Collaboration';
  const summary = diff >= 0
    ? `${stageLabel} closes in ${duration}`
    : `${stageLabel} closed ${duration} ago`;
  return {
    summary,
    detail: intlDateFormatter.format(target)
  };
};

export function MainView() {
  const audioContext = useContext(AudioEngineContext);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();
  const { collaborationId } = useParams();

  // get data from different slices
  const { user } = useAppStore(state => state.auth);
  const { 
    regularTracks,
    favorites,
    backingTrack,
    loadCollaboration,
    loadCollaborationAnonymousById,
    // markAsListened,
    addToFavorites,
    removeFromFavorites,
    voteFor,
    isTrackListened,
    isTrackFavorite
  } = useAppStore(state => state.collaboration);
  const { playSubmission } = useAppStore(state => state.playback);
  const { currentProject, currentCollaboration } = useAppStore(state => state.collaboration);

  if (!audioContext) {
    return <div>Audio engine not available</div>;
  }
  const { engine, state } = audioContext;
  const pendingBackingUrlRef = useRef<string>('');

  const collabId = useMemo(() => collaborationId || null, [collaborationId]);

  // load collaboration data based on url and auth
  useEffect(() => {
    if (!collabId) return;
    if (user) {
      loadCollaboration(user.uid, collabId);
    } else {
      loadCollaborationAnonymousById(collabId);
    }
  }, [collabId, user, loadCollaboration, loadCollaborationAnonymousById]);

  useEffect(() => {
    if (!engine) return;
    const srcToFilePath = (src: string): string => {
      if (!src) return '';
      if (src.startsWith('/test-audio/')) return src.replace('/test-audio/', '');
      if (src.startsWith('http')) {
        const idx = src.indexOf('/o/');
        if (idx !== -1) {
          let rest = src.substring(idx + 3);
          const q = rest.indexOf('?');
          if (q !== -1) rest = rest.substring(0, q);
          try { return decodeURIComponent(rest); } catch { return rest; }
        }
      }
      return src;
    };
    const onListened = (trackSrc: string) => {
      const clean = srcToFilePath(trackSrc);
      const { collaboration } = useAppStore.getState();
      const track = collaboration.allTracks.find(t => t.filePath === clean || t.optimizedPath === clean);
      if (track) {
        collaboration.markAsListened(track.filePath);
      }
    };
    const isListened = (trackSrc: string) => {
      const clean = srcToFilePath(trackSrc);
      const { collaboration } = useAppStore.getState();
      const track = collaboration.allTracks.find(t => t.filePath === clean || t.optimizedPath === clean);
      if (!track) return false;
      return collaboration.isTrackListened(track.filePath);
    };
    engine.setTrackListenedCallback(onListened, 7, isListened);
    return () => {
      engine.clearTrackListenedCallback();
    };
  }, [engine]);

  // Resolve and preload backing track for faster first play
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!engine) return;
      const path = backingTrack?.filePath || '';
      if (!path) return;
      try {
        let url = '';
        if (path.startsWith('/test-audio/')) url = path;
        else if (!path.startsWith('collabs/')) url = `/test-audio/${path}`;
        else url = await getDownloadURL(ref(storage, path));
        if (!cancelled && url) {
          pendingBackingUrlRef.current = url;
          engine.preloadBacking(url);
        }
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [engine, backingTrack?.filePath]);

  // Fallback: on first user gesture after refresh, unlock and re-preload backing
  useEffect(() => {
    if (!engine) return;
    const handler = async () => {
      await engine.unlock?.();
      const url = pendingBackingUrlRef.current;
      if (url) engine.preloadBacking(url);
    };
    window.addEventListener('pointerdown', handler, { once: true });
    window.addEventListener('keydown', handler, { once: true });
    return () => {
      window.removeEventListener('pointerdown', handler as any);
      window.removeEventListener('keydown', handler as any);
    };
  }, [engine]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 100);
    
    return () => clearTimeout(timer);
  }, [user?.uid]);

  if (isLoading) {
    return <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      height: '100vh',
      backgroundColor: 'var(--background)',
      color: 'var(--white)'
    }}>
      Loading...
    </div>;
  }

  const stage = currentCollaboration?.status ?? 'submission';
  const { label: stageLabel, description: stageDescription } = stageCopy[stage];
  const activeDeadline = stage === 'submission'
    ? currentCollaboration?.submissionCloseAt
    : stage === 'voting'
      ? currentCollaboration?.votingCloseAt
      : currentCollaboration?.completedAt;
  const deadlineInfo = getDeadlineInfo(stage, activeDeadline);

  const totalTracks = regularTracks.length;
  const listenedCount = regularTracks.reduce((count, track) => count + (isTrackListened(track.filePath) ? 1 : 0), 0);
  const favoriteCount = favorites.length;
  const participantCount = currentCollaboration?.participantIds?.length ?? 0;
  const finalVote = useAppStore.getState().collaboration.userCollaboration?.finalVote || null;

  return (
    <div className="main-page">
      <header className="main-page__header">
        <div className="main-page__heading">
          <span className="main-page__eyebrow">{currentProject?.name || 'Untitled project'}</span>
          <h1 className="main-page__title">{currentCollaboration?.name || 'Collaboration room'}</h1>
          <p className="main-page__lead">
            {currentProject?.description || 'Introduce the project vision so new collaborators have immediate context.'}
          </p>
          {currentCollaboration?.description && (
            <p className="main-page__collab-description">{currentCollaboration.description}</p>
          )}
          <div className="main-page__status">
            <span className={`status-chip status-chip--${stage}`}>
              {stageLabel}
            </span>
            <div className="status-copy">
              <strong>{deadlineInfo.summary}</strong>
              <span>{deadlineInfo.detail}</span>
            </div>
          </div>
        </div>
        <div className="main-page__quick-actions">
          <button
            type="button"
            className="quick-action quick-action--primary"
            onClick={() => {
              if (!collabId) return;
              navigate(`/collab/${collabId}/submit`);
            }}
            disabled={!collabId}
          >
            <span className="quick-action__label">Upload idea</span>
            <span className="quick-action__desc">Share stems or a bounce for instant feedback.</span>
          </button>
          <button
            type="button"
            className="quick-action"
            disabled
          >
            <span className="quick-action__label">Start live session</span>
            <span className="quick-action__desc">Plan a listening party once realtime rooms are ready.</span>
          </button>
          <button
            type="button"
            className="quick-action"
            disabled
          >
            <span className="quick-action__label">Drop a session note</span>
            <span className="quick-action__desc">Leave guidance for collaborators joining later.</span>
          </button>
        </div>
      </header>

      <section className="main-page__meta">
        <div className="meta-card">
          <h3>Stage overview</h3>
          <p>{stageDescription}</p>
        </div>
        <div className="meta-card">
          <h3>Engagement</h3>
          <ul>
            <li><span>{participantCount}</span> contributors in the room</li>
            <li><span>{favoriteCount}</span> favorites saved</li>
            <li><span>{listenedCount}/{Math.max(totalTracks, 1)}</span> tracks heard</li>
          </ul>
        </div>
        <div className="meta-card">
          <h3>What’s next</h3>
          <p>
            {finalVote
              ? 'You have a finalist selected — align with the team before final mixdown.'
              : 'Keep listening and mark your final pick once you have a clear favorite.'}
          </p>
        </div>
      </section>

      <div className="main-page__body">
        <div className="main-page__column">
          <section className="panel">
            <header className="panel__header">
              <div>
                <h2 className="panel__title">Collab timeline</h2>
                <p className="panel__subtitle">Replay past winners and see how the track evolved.</p>
              </div>
            </header>
            <div className="panel__body panel__body--flush">
              <ProjectHistory />
            </div>
          </section>

          <section className="panel">
            <header className="panel__header">
              <div>
                <h2 className="panel__title">Session notes</h2>
                <p className="panel__subtitle">Draft the conversation starters you’ll polish later.</p>
              </div>
            </header>
            <div className="panel__body">
              {sessionDrafts.map(note => (
                <article key={note.title} className="note-card">
                  <h3>{note.title}</h3>
                  <ul>
                    {note.items.map(item => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </section>
        </div>

        <div className="main-page__column main-page__column--center">
          <section className="panel panel--favorites">
            <header className="panel__header">
              <div>
                <h2 className="panel__title">Favorites</h2>
                <p className="panel__subtitle">Pin top contenders and return to them quickly.</p>
              </div>
            </header>
            <div className="panel__body panel__body--flush">
              <Favorites
                onRemoveFromFavorites={(trackId) => removeFromFavorites(trackId)}
                favorites={favorites}
                onAddToFavorites={(trackId) => addToFavorites(trackId)}
                onPlay={(trackId, index, favorite) => playSubmission(trackId, index, favorite)}
                voteFor={voteFor}
                listenedRatio={7}
                finalVote={finalVote}
              />
            </div>
          </section>

          <section className="panel panel--submissions">
            <header className="panel__header">
              <div>
                <h2 className="panel__title">All submissions</h2>
                <p className="panel__subtitle">Browse every take that’s ready for review.</p>
              </div>
            </header>
            <div className="panel__body">
              {totalTracks === 0 ? (
                <div className="empty-state">
                  <h3>No submissions yet</h3>
                  <p>Once collaborators start uploading, you’ll see the full queue here.</p>
                </div>
              ) : (
                <div className="submission-grid">
                  {regularTracks.filter(track => !isTrackFavorite(track.filePath)).map((track, index) => (
                    <SubmissionItem
                      key={track.id}
                      track={track}
                      index={index}
                      isCurrentTrack={
                        !state.playerController.pastStagePlayback &&
                        !state.playerController.playingFavourite &&
                        state.playerController.currentTrackId === index
                      }
                      isPlaying={state.player1.isPlaying}
                      listened={isTrackListened(track.filePath)}
                      favorite={isTrackFavorite(track.filePath)}
                      onAddToFavorites={() => addToFavorites(track.filePath)}
                      onPlay={(filePath, trackIndex) => playSubmission(filePath, trackIndex, false)}
                      voteFor={voteFor}
                      listenedRatio={7}
                      isFinal={false}
                    />
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>

        <div className="main-page__column">
          <section className="panel">
            <header className="panel__header">
              <div>
                <h2 className="panel__title">Communication hub</h2>
                <p className="panel__subtitle">Sketch where chat, comments, and reactions will live.</p>
              </div>
            </header>
            <div className="panel__body">
              {communicationDrafts.map(draft => (
                <article key={draft.title} className="draft-card">
                  <h3>{draft.title}</h3>
                  <p>{draft.body}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="panel">
            <header className="panel__header">
              <div>
                <h2 className="panel__title">Roadmap</h2>
                <p className="panel__subtitle">Capture the experiences you plan to implement next.</p>
              </div>
            </header>
            <div className="panel__body">
              <ul className="roadmap-list">
                {roadmapDrafts.map(item => (
                  <li key={item.title}>
                    <strong>{item.title}</strong>
                    <span>{item.caption}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <section className="panel panel--mixer">
            <header className="panel__header">
              <div>
                <h2 className="panel__title">Live mixer</h2>
                <p className="panel__subtitle">Balance the backing track with each submission in realtime.</p>
              </div>
            </header>
            <div className="panel__body panel__body--flush">
              <Mixer
                state={state}
              />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
