import React from 'react';
import { useAppStore } from '../stores/appStore';

export function StoreTest() {
  const { 
    user, 
    setUser, 
    submissions, 
    favorites, 
    isLoading, 
    setLoading 
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
      <div>Submissions: {submissions.length}</div>
      <div>Favorites: {favorites.length}</div>
      <div>Loading: {isLoading ? 'Yes' : 'No'}</div>
      <button onClick={handleTestUser}>Test User</button>
      <button onClick={handleTestLoading}>Toggle Loading</button>
    </div>
  );
} 