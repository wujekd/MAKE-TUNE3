
import { useState } from 'react';
import { MainView } from './views/MainView'
import { AuthView } from './views/auth/AuthView'
import { useAuth } from './contexts/AuthContext'

function App() {
  const { user, loading } = useAuth();
  const [showAuth, setShowAuth] = useState(false);

  if (loading) {
    return <div>Loading...</div>;
  }

  if (showAuth) {
    return <AuthView onBackToMain={() => setShowAuth(false)} />;
  }

  return <MainView onShowAuth={() => setShowAuth(true)} />;
}

export default App
