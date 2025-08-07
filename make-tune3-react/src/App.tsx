import { useEffect } from 'react';
import { useState } from 'react';
import { MainView } from './views/MainView'
import { AuthView } from './views/auth/AuthView'
import { useAppStore } from './stores/appStore'

function App() {
  const { user, loading } = useAppStore(state => state.auth);
  const { showAuth, setShowAuth } = useAppStore(state => state.ui);

  useEffect(() => {
    // console.log('app render - user:', user?.email, 'loading:', loading);
  }, [user, loading]);

  // hide auth view when user logs in successfully
  useEffect(() => {
    if (user && showAuth) {
      // console.log('app: hiding auth view after successful login');
      setShowAuth(false);
    }
  }, [user, showAuth, setShowAuth]);

  if (loading) {
          // console.log('app: showing loading screen');
    return <div>Loading...</div>;
  }
  
  if (showAuth) {
          console.log('app: showing auth view');
    return <AuthView onBackToMain={() => setShowAuth(false)} />;
  }
  
        // console.log('app: showing main view');
  return <MainView key={user?.uid || 'anonymous'} onShowAuth={() => setShowAuth(true)} />;
}

export default App