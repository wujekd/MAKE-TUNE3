// import { useState, useEffect } from 'react';
// import { audioFiles } from '../data/mock-audio';
// import { useAuth } from '../contexts/AuthContext';

// export function useCollabData(collabId?: string, engine?: any) {
//   const { user } = useAuth();
//   const [allSubmissions, setAllSubmissions] = useState<string[]>([]);
//   const [pastStageTracklist, setPastStageTracklist] = useState<string[]>([]);
//   const [backingTrackSrc, setBackingTrackSrc] = useState<string>('');
//   const [listened, setListened] = useState<string[]>([]);
//   const [favourites, setFavourites] = useState<string[]>([]);
//   const [finalVote, setFinalVote] = useState<string>('');
//   const listenedRatio = 5

//   useEffect(() => {
//     // fetch data
//     setAllSubmissions(audioFiles.player1Files);
//     setPastStageTracklist(audioFiles.pastStageFiles);
//     setBackingTrackSrc(audioFiles.player2Files[0]);
//     setListened(audioFiles.listened);
//     setFavourites(audioFiles.favourites);
//     setFinalVote(audioFiles.votedFor[0]);
//   }, [collabId, user?.uid]);

//   // filter submissions based on favorites
//   const regularSubmissions = allSubmissions.filter(submission => 
//     !favourites.includes(submission)
//   )

//   const markAsListened = (src: string) => {
//     console.log("Mark as listened triggered: ", src);
    
//     if (src && !listened.includes(src)) {
//       setListened(prev => [...prev, src]);
//       console.log("Track marked as listened:", src);
//     }
//   }
  
// //   const favoritedSubmissions = allSubmissions.filter(submission => 
// //     favourites.includes(submission)
// //   );
//   const voteFor = (src: string) => {
//     console.log("triggered voted for ", src);
//     setFinalVote(src);
//   }
//   const addToFavourites = (src: string) => {
//     console.log("sub added: ", src)
//     if (src && !favourites.includes(src)) {
//       setFavourites(prev => {
//         const newFavourites = [...prev, src];
        
//         if (engine) {
//           const currentState = engine.getState();
//           const currentSource = currentState.player1.source;
          
//           console.log("addToFavourites - currentSource:", currentSource);
//           console.log("addToFavourites - currentState.playerController:", currentState.playerController);
          
//           // added track is currently playing
//           if (currentSource === src) {
//             console.log("addToFavourites - updating playing track");
//             engine.setPlayingFavourite(true);
//             // update to the new index in favorites list
//             const newIndex = newFavourites.indexOf(src);
//             console.log("addToFavourites - new index:", newIndex);
//             engine.updateCurrentTrackId(newIndex);
//           }
//           //different track is currently playing and it's in favorites
//           else if (currentSource && currentState.playerController.playingFavourite) {
//             console.log("addToFavourites - updating other track in favorites");
//             const newIndex = newFavourites.indexOf(currentSource);
//             console.log("addToFavourites - new index for current track:", newIndex);
//             if (newIndex !== -1) {
//               // Update to the new index in the updated favorites list
//               engine.updateCurrentTrackId(newIndex);
//             }
//           }
//           // different track is currently playing in regular submissions
//           else if (currentSource && !currentState.playerController.playingFavourite && !currentState.playerController.pastStagePlayback) {
//             console.log("addToFavourites - updating other track in regular submissions");
//             // recalculate regular submissions without the added track
//             const newRegularSubmissions = allSubmissions.filter(submission => 
//               !newFavourites.includes(submission)
//             );
//             const newIndex = newRegularSubmissions.indexOf(currentSource);
//             console.log("addToFavourites - new index for current track in regular:", newIndex);
//             if (newIndex !== -1) {
//               // update to the new index in the updated regular submissions list
//               engine.updateCurrentTrackId(newIndex);
//             }
//           }
//         }
//         return newFavourites;
//       });
//     }
//   };
//   const removeFromFavourites = (index: number) => {
//     const submission = favourites[index];
    
//     if (submission) {
//       setFavourites(prev => {
//         const newFavourites = prev.filter(fav => fav !== submission);
        
//         if (engine) {
//           const currentState = engine.getState();
//           const currentSource = currentState.player1.source;
          
//           console.log("removeFromFavourites - removed submission:", submission);
//           console.log("removeFromFavourites - currentSource:", currentSource);
//           console.log("removeFromFavourites - currentState.playerController:", currentState.playerController);
          
//           // removed track is currently playing
//           if (currentSource === submission) {
//             console.log("removeFromFavourites - updating playing track");
//             engine.setPlayingFavourite(false);
//             // find the track in regular submissions and update index
//             const regularIndex = allSubmissions.indexOf(submission);
//             console.log("removeFromFavourites - regular index:", regularIndex);
//             if (regularIndex !== -1) {
//               engine.updateCurrentTrackId(regularIndex);
//             }
//           }
//           // different track is currently playing and its in favorites
//           else if (currentSource && currentState.playerController.playingFavourite) {
//             console.log("removeFromFavourites - updating other track in favorites");
//             const newIndex = newFavourites.indexOf(currentSource);
//             console.log("removeFromFavourites - new index for current track:", newIndex);
//             if (newIndex !== -1) {
//               // Update to the new index in the updated favorites list
//               engine.updateCurrentTrackId(newIndex);
//             }
//           }
//           // different track is currently playing in regular submissions
//           else if (currentSource && !currentState.playerController.playingFavourite && !currentState.playerController.pastStagePlayback) {
//             console.log("removeFromFavourites - updating other track in regular submissions");
//             // recalculate regular submissions with the removed track back in
//             const newRegularSubmissions = allSubmissions.filter(submission => 
//               !newFavourites.includes(submission)
//             );
//             const newIndex = newRegularSubmissions.indexOf(currentSource);
//             console.log("removeFromFavourites - new index for current track in regular:", newIndex);
//             if (newIndex !== -1) {
//               // update to the new index in the updated regular submissions list
//               engine.updateCurrentTrackId(newIndex);
//             }
//           }
//         }
        
//         return newFavourites;
//       });
//     }
//   };
//   return { 
//     regularSubmissions, 
//     pastStageTracklist, 
//     backingTrackSrc, 
//     listened, 
//     favourites,
//     addToFavourites,
//     removeFromFavourites,
//     voteFor,
//     markAsListened,
//     listenedRatio,
//     finalVote
//   };
// }