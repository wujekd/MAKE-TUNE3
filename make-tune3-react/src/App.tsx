import { useEffect } from 'react';
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
import { MainView } from './views/MainView'
import { AuthView } from './views/auth/AuthView'
import { CollabListView } from './views/CollabListView'
import { ProjectEditView } from './views/ProjectEditView'
import { SubmissionView } from './views/SubmissionView'
import { useAppStore } from './stores/appStore'
import { ModerationView } from './views/ModerationView'
import { AppShell } from './components/AppShell';

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

  const router = createBrowserRouter([
    {
      element: showAuth ? <AuthView onBackToMain={() => setShowAuth(false)} /> : <AppShell />,
      children: showAuth ? [] : [
        {
          path: '/collabs',
          element: <CollabListView />,
          handle: {
            title: 'Collaborations',
            breadcrumb: 'Collaborations',
            actions: () => ([{ key: 'to-auth', label: 'Login', onClick: () => useAppStore.getState().ui.setShowAuth(true) }])
          }
        },
        {
          path: '/project/:projectId',
          element: <ProjectEditView />,
          handle: {
            title: 'Project',
            breadcrumb: 'Project',
            actions: ({ navigate: nav }: any) => ([{ key: 'back', label: 'Back', onClick: () => nav(-1) }])
          }
        },
        {
          path: '/collab/:collaborationId',
          element: <MainView key={user?.uid || 'anonymous'} />,
          handle: {
            title: 'Collaboration',
            breadcrumb: 'Collaboration',
            actions: ({ navigate, params, collab }: any) => ([
              { key: 'back', label: 'Back', onClick: () => navigate(-1) },
              collab?.status === 'submission' ? { key: 'to-submit', label: 'Submit', onClick: () => navigate(`/collab/${params.collaborationId}/submit`) } : null
            ].filter(Boolean))
          }
        },
        {
          path: '/collab/:collaborationId/moderate',
          element: <ModerationView />,
          handle: {
            title: 'Moderation',
            breadcrumb: 'Moderation',
            actions: ({ navigate }: any) => ([{ key: 'back', label: 'Back', onClick: () => navigate(-1) }])
          }
        },
        {
          path: '/collab/:collaborationId/submit',
          element: <SubmissionView />,
          handle: {
            title: 'Submit',
            breadcrumb: 'Submit',
            actions: ({ navigate, params }: any) => ([
              { key: 'back', label: 'Back', onClick: () => navigate(-1) },
              { key: 'to-collab', label: 'To voting', onClick: () => navigate(`/collab/${params.collaborationId}`) }
            ])
          }
        },
        { path: '*', element: <Navigate to="/collabs" replace /> }
      ]
    }
  ]);

  return <RouterProvider router={router} />;
}

export default App