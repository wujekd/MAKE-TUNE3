import { useEffect } from 'react';
import { useState } from 'react';
import { MainView } from './views/MainView'
import { AuthView } from './views/auth/AuthView'
import { useAuth } from './contexts/AuthContext'

function App() {
  const { user, loading } = useAuth();
  const [showAuth, setShowAuth] = useState(false);

  

  // useEffect(() => {
  //   // This will trigger a refresh (re-render) when loading changes
  //   // No explicit action needed, but you can place logic here if needed in the future
  // }, [loading.valueOf]);

  if (loading) {
    return <div>Loading...</div>;
  }
  if (showAuth) {
    return <AuthView onBackToMain={() => setShowAuth(false)} />;
  }
  return <MainView key={user?.uid || 'anonymous'} onShowAuth={() => setShowAuth(true)} />;
}

export default App
