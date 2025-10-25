import { useEffect } from 'react';
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
import { MainView } from './views/MainView'
import { CollabListView } from './views/CollabListView'
import { ProjectEditView } from './views/ProjectEditView'
import { SubmissionView } from './views/SubmissionView'
import { useAppStore } from './stores/appStore'
import { useUIStore } from './stores'
import { ModerationView } from './views/ModerationView'
import { AppShell } from './components/AppShell';
import { AuthRoute } from './components/AuthRoute';
import { CompletedView } from './views/CompletedView';
import { UsernameOnboarding } from './views/UsernameOnboarding';
import { LandingView } from './views/LandingView';

function App() {
  const { user, loading } = useAppStore(state => state.auth);
  const { setShowAuth } = useUIStore();

  useEffect(() => {
    // console.log('app render - user:', user?.email, 'loading:', loading);
  }, [user, loading]);

  // hide auth view when user logs in successfully
  useEffect(() => {
    if (user) {
      setShowAuth(false);
    }
  }, [user, setShowAuth]);

  const router = createBrowserRouter([
    {
      element: <AppShell />,
      children: [
        {
          index: true,
          element: <LandingView />,
          handle: {
            title: 'Home',
            breadcrumb: 'Home',
            actions: ({ navigate }: any) => ([
              { key: 'open-collabs', label: 'Open workspace', onClick: () => navigate('collabs') }
            ])
          }
        },
        { path: 'onboarding/username', element: <UsernameOnboarding />, handle: { title: 'Choose Username', breadcrumb: 'Username' } },
        {
          path: 'collabs',
          element: <CollabListView />,
          handle: {
            title: 'Collaborations',
            breadcrumb: 'Collaborations',
            actions: ({ navigate }: any) => ([{ key: 'to-auth', label: 'Login', onClick: () => navigate('auth') }])
          }
        },
        {
          path: 'project/:projectId',
          element: <ProjectEditView />,
          handle: {
            title: 'Project',
            breadcrumb: 'Project',
            actions: ({ navigate: nav }: any) => ([{ key: 'back', label: 'Back', onClick: () => nav(-1) }])
          }
        },
        {
          path: 'collab/:collaborationId',
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
          path: 'collab/:collaborationId/moderate',
          element: <ModerationView />,
          handle: {
            title: 'Moderation',
            breadcrumb: 'Moderation',
            actions: ({ navigate }: any) => ([{ key: 'back', label: 'Back', onClick: () => navigate(-1) }])
          }
        },
        {
          path: 'collab/:collaborationId/completed',
          element: <CompletedView />,
          handle: {
            title: 'Completed',
            breadcrumb: 'Completed',
            actions: ({ navigate, params }: any) => ([
              { key: 'back', label: 'Back', onClick: () => navigate(-1) },
              { key: 'to-collab', label: 'Open collab', onClick: () => navigate(`/collab/${params.collaborationId}`) }
            ])
          }
        },
        {
          path: 'collab/:collaborationId/submit',
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
        { path: '*', element: <Navigate to="collabs" replace /> }
      ]
    },
    { path: '/auth', element: <AuthRoute /> }
  ]);

  return <RouterProvider router={router} />;
}

export default App