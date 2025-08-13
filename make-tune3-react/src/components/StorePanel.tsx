import React from 'react';
import { useAppStore } from '../stores/appStore';

export function StorePanel() {
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
  const { isLoading, setLoading } = useAppStore(state => state.ui);
  const { state: audioState, engine: audioEngine } = useAppStore(state => state.audio);

  const favoriteTracks = allTracks.filter(track => isTrackFavorite(track.filePath));
  const listenedTracks = allTracks.filter(track => isTrackListened(track.filePath));
  const favoriteFilePaths = userCollaboration?.favoriteTracks || [];

  return (
    <div style={{
      backgroundColor: 'var(--primary1-900)',
      padding: '10px 4px',
      border: '1px solid rgba(255,255,255,0.15)',
      borderRadius: 8,
      fontSize: 12,
      color: 'var(--white)',
      boxShadow: '0 4px 12px rgba(0,0,0,0.35)',
      display: 'inline-block'
    }}>
      <div style={{ fontWeight: 500, marginBottom: 6 }}>Store</div>

      <div style={{ marginBottom: 6 }}>
        <strong>User:</strong> {user?.email || 'None'}
      </div>

      <div style={{ marginBottom: 6 }}>
        <strong>Collaboration:</strong>
        <div>ID: {currentCollaboration?.id || 'None'}</div>
        <div>Name: {currentCollaboration?.name || 'None'}</div>
        <div>Loading: {isLoadingCollaboration ? 'Yes' : 'No'}</div>
        <div>Project Loading: {isLoadingProject ? 'Yes' : 'No'}</div>
      </div>

      <div style={{ marginBottom: 6 }}>
        <strong>User Collaboration:</strong>
        <div>Favorites: {userCollaboration?.favoriteTracks?.length || 0}</div>
        <div>Listened: {userCollaboration?.listenedTracks?.length || 0}</div>
        <div>Vote: {userCollaboration?.finalVote || 'None'}</div>
        <div style={{ fontSize: 10 }}>
          <strong>Favorite File Paths:</strong>
          {favoriteFilePaths.map((path, index) => (
            <div key={index}>{index + 1}. {path}</div>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
        <div>
          <strong>Tracks:</strong>
          <div>All: {allTracks.length}</div>
          <div>Regular: {regularTracks.length}</div>
          <div>Favorites: {favoriteTracks.length}</div>
          <div>Listened: {listenedTracks.length}</div>
          <div>Past Stage: {pastStageTracks.length}</div>
          <div>Backing: {backingTrack ? 'Yes' : 'No'}</div>
        </div>
        <div>
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
      </div>

      <div style={{ marginBottom: 10 }}>
        <strong>UI:</strong>
        <div>Loading: {isLoading ? 'Yes' : 'No'}</div>
      </div>

      <button onClick={() => setLoading(!isLoading)}>Toggle Loading</button>
    </div>
  );
}

