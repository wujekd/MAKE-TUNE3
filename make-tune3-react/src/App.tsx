import { useEffect } from 'react';
import { useState } from 'react';
import { MainView } from './views/MainView'
import { AuthView } from './views/auth/AuthView'
import { useAppStore } from './stores/appStore'

function App() {
  const { user, authLoading } = useAppStore();
  const [showAuth, setShowAuth] = useState(false);

  useEffect(() => {
    console.log('🚀 App render - user:', user?.email, 'authLoading:', authLoading);
  }, [user, authLoading]);

  // Auto-hide auth view when user logs in successfully
  useEffect(() => {
    if (user && showAuth) {
      console.log('🚀 App: Auto-hiding auth view after successful login');
      setShowAuth(false);
    }
  }, [user, showAuth]);

  if (authLoading) {
    console.log('🚀 App: Showing loading screen');
    return <div>Loading...</div>;
  }
  
  if (showAuth) {
    console.log('🚀 App: Showing auth view');
    return <AuthView onBackToMain={() => setShowAuth(false)} />;
  }
  
  console.log('🚀 App: Showing main view');
  return <MainView key={user?.uid || 'anonymous'} onShowAuth={() => setShowAuth(true)} />;
}

export default App
