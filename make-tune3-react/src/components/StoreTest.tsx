import React from 'react';
import { useAppStore } from '../stores/appStore';
import { useAudioStore, useUIStore } from '../stores';

export function StoreTest() {
  const { user } = useAppStore(state => state.auth);
  const { 
    regularTracks, 
    allTracks, 
    pastStageTracks, 
    backingTrack,
    currentCollaboration,
    userCollaboration,
    isLoadingCollaboration,
    isLoadingProject,
    isTrackFavorite,
    isTrackListened
  } = useAppStore(state => state.collaboration);
  const { isLoading, setLoading } = useUIStore();
  const { state: audioState, engine: audioEngine } = useAudioStore();

  const handleTestLoading = () => {
    setLoading(!isLoading);
  };

  const favoriteTracks = allTracks.filter(track => isTrackFavorite(track.filePath));
  const listenedTracks = allTracks.filter(track => isTrackListened(track.filePath));

  // Debug: Log the favorite file paths from userCollaboration
  const favoriteFilePaths = userCollaboration?.favoriteTracks || [];

  return (
    <details style={{
      backgroundColor: 'var(--primary1-900)',
      padding: '6px 8px',
      border: '1px solid rgba(255,255,255,0.15)',
      borderRadius: '6px',
      fontSize: '12px',
      color: 'var(--white)'
    }}>
      <summary style={{ cursor: 'pointer', fontWeight: 400 }}>
        Store
      </summary>
      
      <div style={{ marginBottom: '10px' }}>
        <strong>User:</strong> {user?.email || 'None'}
      </div>

      <div style={{ marginBottom: '10px' }}>
        <strong>Collaboration:</strong>
        <div>ID: {currentCollaboration?.id || 'None'}</div>
        <div>Name: {currentCollaboration?.name || 'None'}</div>
        <div>Loading: {isLoadingCollaboration ? 'Yes' : 'No'}</div>
        <div>Project Loading: {isLoadingProject ? 'Yes' : 'No'}</div>
      </div>

      <div style={{ marginBottom: '10px' }}>
        <strong>User Collaboration:</strong>
        <div>Favorites: {userCollaboration?.favoriteTracks?.length || 0}</div>
        <div>Listened: {userCollaboration?.listenedTracks?.length || 0}</div>
        <div>Vote: {userCollaboration?.finalVote || 'None'}</div>
        <div style={{ fontSize: '10px', marginLeft: '10px' }}>
          <strong>Favorite File Paths:</strong>
          {favoriteFilePaths.map((path, index) => (
            <div key={index}>{index + 1}. {path}</div>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: '10px' }}>
        <strong>Tracks:</strong>
        <div>All: {allTracks.length}</div>
        <div>Regular: {regularTracks.length}</div>
        <div>Favorites: {favoriteTracks.length}</div>
        <div>Listened: {listenedTracks.length}</div>
        <div>Past Stage: {pastStageTracks.length}</div>
        <div>Backing: {backingTrack ? 'Yes' : 'No'}</div>
      </div>

      <div style={{ marginBottom: '10px' }}>
        <strong>All Tracks (Debug):</strong>
        {allTracks.map((track, index) => (
          <div key={track.id} style={{ fontSize: '10px', marginLeft: '10px' }}>
            {index + 1}. {track.title} ({track.filePath}) - Favorite: {isTrackFavorite(track.filePath) ? 'Yes' : 'No'}
          </div>
        ))}
      </div>

      <div style={{ marginBottom: '10px' }}>
        <strong>Regular Tracks:</strong>
        {regularTracks.map((track, index) => (
          <div key={track.id} style={{ fontSize: '10px', marginLeft: '10px' }}>
            {index + 1}. {track.title} ({track.filePath})
          </div>
        ))}
      </div>

      <div style={{ marginBottom: '10px' }}>
        <strong>Favorite Tracks:</strong>
        {favoriteTracks.map((track, index) => (
          <div key={track.id} style={{ fontSize: '10px', marginLeft: '10px', color: 'orange' }}>
            {index + 1}. {track.title} ({track.filePath})
          </div>
        ))}
      </div>

      <div style={{ marginBottom: '10px' }}>
        <strong>Audio:</strong>
        <div>Engine: {audioEngine ? 'Loaded' : 'Not loaded'}</div>
        <div>State: {audioState ? 'Synced' : 'Not synced'}</div>
        {audioState && (
          <div>
            <div>Player1 Playing: {audioState.player1.isPlaying ? 'Yes' : 'No'}</div>
            <div>Player2 Playing: {audioState.player2.isPlaying ? 'Yes' : 'No'}</div>
            <div>Current Track: {audioState.playerController.currentTrackId}</div>
            <div>Past Stage: {audioState.playerController.pastStagePlayback ? 'Yes' : 'No'}</div>
            <div>Playing Favorite: {audioState.playerController.playingFavourite ? 'Yes' : 'No'}</div>
          </div>
        )}
      </div>

      <div style={{ marginBottom: '10px' }}>
        <strong>UI:</strong>
        <div>Loading: {isLoading ? 'Yes' : 'No'}</div>
      </div>

      <button onClick={handleTestLoading}>Toggle Loading</button>
    </details>
  );
} 