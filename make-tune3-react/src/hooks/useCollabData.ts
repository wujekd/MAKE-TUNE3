import { useState, useEffect } from 'react';
import { audioFiles } from '../data/mock-audio';

export function useCollabData(collabId?: string) {
  const [allSubmissions, setAllSubmissions] = useState<string[]>([]);
  const [pastStageTracklist, setPastStageTracklist] = useState<string[]>([]);
  const [backingTrackSrc, setBackingTrackSrc] = useState<string>('');
  const [listened, setListened] = useState<string[]>([]);
  const [favourites, setFavourites] = useState<string[]>([]);

  useEffect(() => {
    // Fetch all data from database/API
    setAllSubmissions(audioFiles.player1Files);
    setPastStageTracklist(audioFiles.pastStageFiles);
    setBackingTrackSrc(audioFiles.player2Files[0]);
    setListened(audioFiles.listened);
    setFavourites(audioFiles.favourites);
  }, [collabId]);

  // Filter submissions based on favorites
  const regularSubmissions = allSubmissions.filter(submission => 
    !favourites.includes(submission)
  );
  
//   const favoritedSubmissions = allSubmissions.filter(submission => 
//     favourites.includes(submission)
//   );

  const addToFavourites = (src: string) => {
    console.log("sub added: ", src)
    if (src && !favourites.includes(src)) {
      setFavourites(prev => [...prev, src]);
    }
  };

  const removeFromFavourites = (index: number) => {
    const submission = favourites[index];
    
    if (submission) {
      setFavourites(prev => prev.filter(fav => fav !== submission));
    }
  };

  return { 
    regularSubmissions, 
    pastStageTracklist, 
    backingTrackSrc, 
    listened, 
    favourites,
    addToFavourites,
    removeFromFavourites
  };
}