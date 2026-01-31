import { useContext, useEffect, useState } from 'react';
import { AudioEngineContext } from '../audio-services/AudioEngineContext';
import type { Track } from '../types/collaboration';
import { DownloadButton } from './DownloadButton';
import './SubmissionItem.css';

type Props = {
  track: Track;
  index: number;
  isPlaying: boolean;
  isCurrentTrack: boolean;
  onPlay: (trackId: string, index: number) => void;
};

export function ModerationSubmissionItem({ track, index, isPlaying, isCurrentTrack, onPlay }: Props) {
  const audioContext = useContext(AudioEngineContext);
  if (!audioContext) {
    return <div>Loading audio engine...</div>;
  }
  const { engine, state } = audioContext;
  const [pendingPlay, setPendingPlay] = useState(false);

  const displayProgress = isCurrentTrack && state.player1.duration > 0
    ? (state.player1.currentTime / state.player1.duration) * 100
    : 0;

  const handlePlayClick = () => {
    if (isPlaying && isCurrentTrack) {
      engine.pause();
      setPendingPlay(false);
    } else {
      setPendingPlay(true);
      onPlay(track.filePath, index);
    }
  };

  useEffect(() => {
    if (isCurrentTrack && isPlaying) {
      setPendingPlay(false);
    }
  }, [isCurrentTrack, isPlaying]);

  return (
    <div className={`
      submission-container
      ${isCurrentTrack ? 'currently-playing' : ''}
      ${track.moderationStatus === 'approved' ? 'moderation-approved' : ''}
      ${track.moderationStatus === 'rejected' ? 'moderation-rejected' : ''}
      ${track.moderationStatus === 'pending' ? 'moderation-pending' : ''}
    `}>
      <div style={{ fontSize: '10px', color: 'white', marginBottom: '4px' }}>
        Track: {track.title}
      </div>
      <button
        className="play-button"
        onClick={handlePlayClick}
      >
        <div className="progress-bar" style={{ width: `${displayProgress}%` }}></div>
        <span className="play-icon">{pendingPlay ? '…' : (isCurrentTrack && isPlaying ? '❚❚' : '▶')}</span>
      </button>
      <div style={{ fontSize: 11, color: 'var(--white)', opacity: 0.7, marginTop: 6 }}>
        {track.moderationStatus === 'approved' && 'approved'}
        {track.moderationStatus === 'rejected' && 'rejected'}
        {track.moderationStatus === 'pending' && 'pending'}
      </div>
      {track.multitrackZipPath && (
        <DownloadButton
          label="multitracks"
          variant="compact"
          onDownload={async () => {
            const path = track.multitrackZipPath!;
            const { storage } = await import('../services/firebase');
            const { ref, getBlob } = await import('firebase/storage');
            const filename = path.split('/').pop() || 'multitracks.zip';
            const storageRef = ref(storage, path);
            const blob = await getBlob(storageRef);
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
          }}
        />
      )}
    </div>
  );
}
