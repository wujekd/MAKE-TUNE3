import React from 'react';
import { useAppStore } from '../stores/appStore';

export function StoreTest() {
  const {
    user,
    setUser,
    regularSubmissions,
    favourites,
    isLoading,
    setLoading,
    audioState,
    audioEngine
  } = useAppStore();

  const handleTestUser = () => {
    setUser({ uid: 'test', email: 'test@example.com', createdAt: new Date() as any });
  };

  const handleTestLoading = () => {
    setLoading(!isLoading);
  };

  return (
    <div style={{
      position: 'absolute',
      top: '60px',
      right: '10px',
      zIndex: 1000,
      backgroundColor: 'var(--background)',
      padding: '10px',
      border: '1px solid var(--primary)',
      borderRadius: '4px',
      fontSize: '12px'
    }}>
      <h4>Store Test</h4>
      <div>User: {user?.email || 'None'}</div>
      <div>Regular Submissions: {regularSubmissions.length}</div>
      <div>Favourites: {favourites.length}</div>
      <div>Loading: {isLoading ? 'Yes' : 'No'}</div>
      <div>AudioEngine: {audioEngine ? 'Loaded' : 'Not loaded'}</div>
      <div>AudioState: {audioState ? 'Synced' : 'Not synced'}</div>
      {audioState && (
        <div>
          <div>Player1 Playing: {audioState.player1.isPlaying ? 'Yes' : 'No'}</div>
          <div>Player2 Playing: {audioState.player2.isPlaying ? 'Yes' : 'No'}</div>
          <div>Current Track: {audioState.playerController.currentTrackId}</div>
        </div>
      )}
      <button onClick={handleTestUser}>Test User</button>
      <button onClick={handleTestLoading}>Toggle Loading</button>
    </div>
  );
} 