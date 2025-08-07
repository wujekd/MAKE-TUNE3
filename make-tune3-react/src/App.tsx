import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { MainView } from './views/MainView'
import { AuthView } from './views/auth/AuthView'
import { CollabListView } from './views/CollabListView'
import { ProjectEditView } from './views/ProjectEditView'
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

  if (showAuth) {
    return (
      <BrowserRouter>
        <AuthView onBackToMain={() => setShowAuth(false)} />
      </BrowserRouter>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/collabs" element={<CollabListView />} />
        <Route path="/project/:projectId" element={<ProjectEditView />} />
        <Route path="/collab/:collaborationId" element={<MainView key={user?.uid || 'anonymous'} onShowAuth={() => setShowAuth(true)} />} />
        <Route path="*" element={<Navigate to="/collabs" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App