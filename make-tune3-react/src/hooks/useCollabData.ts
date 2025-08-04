import { useState, useEffect } from 'react';
import { audioFiles } from '../data/mock-audio';

export function useCollabData(collabId?: string) {
  const [trackList, setTrackList] = useState<string[]>([]);
  const [pastStageTracklist, setPastStageTracklist] = useState<string[]>([]);
  const [backingTrackSrc, setBackingTrackSrc] = useState<string>('');

  useEffect(() => {
    setTrackList(audioFiles.player1Files);
    setPastStageTracklist(audioFiles.pastStageFiles);
    setBackingTrackSrc(audioFiles.player2Files[0]);
  }, [collabId]);

  return { trackList, pastStageTracklist, backingTrackSrc };
}