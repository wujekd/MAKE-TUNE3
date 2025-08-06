import React from 'react';
import { useAppStore } from '../stores/appStore';

export function StoreTest() {
  const { user } = useAppStore(state => state.auth);
  const { regularTracks } = useAppStore(state => state.collaboration);
  const { isLoading, setLoading } = useAppStore(state => state.ui);
  const { state: audioState, engine: audioEngine } = useAppStore(state => state.audio);

  const handleTestLoading = () => {
    setLoading(!isLoading);
  };

  return (
    <details style={{
      position: 'absolute',
      top: '20px',
      right: '10px',
      zIndex: 1000,
      backgroundColor: 'var(--background)',
      padding: '10px',
      border: '1px solid var(--primary)',
      borderRadius: '4px',
      fontSize: '12px',
      maxWidth: '300px'
    }}>
      <summary style={{ cursor: 'pointer', fontWeight: 'bold', marginBottom: '8px' }}>
        Store Test
      </summary>
      <div>User: {user?.email || 'None'}</div>
      <div>Regular Tracks: {regularTracks.length}</div>
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
      <button onClick={handleTestLoading}>Toggle Loading</button>
    </details>
  );
} 