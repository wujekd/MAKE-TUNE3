import { useEffect } from 'react';
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
import { VotingView } from './views/VotingView'
import { DashboardView } from './views/DashboardView'
import { ProjectEditView } from './views/ProjectEditView'
import { SubmissionView } from './views/SubmissionView'
import { AdminTagsView } from './views/AdminTagsView'
import { AdminProjectsView } from './views/AdminProjectsView'
import { AdminReportedView } from './views/AdminReportedView'
import { AdminResolvedReportsView } from './views/AdminResolvedReportsView'
import { AdminFeedbackView } from './views/AdminFeedbackView'
import { AdminUsersView } from './views/AdminUsersView'
import { AdminSettingsView } from './views/AdminSettingsView'
import { useAppStore } from './stores/appStore'
import { useUIStore } from './stores'
import { ModerationView } from './views/ModerationView'
import { AppShell } from './components/AppShell';
import { AuthRoute } from './components/AuthRoute';
import { AdminRoute } from './components/AdminRoute';
import { CompletedView } from './views/CompletedView';
import { UsernameOnboarding } from './views/UsernameOnboarding';
import { AccessDeniedView } from './views/AccessDeniedView';
import { ProjectService } from './services';
import { RootErrorView } from './components/RootErrorView';

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
      errorElement: <RootErrorView />,
      children: [
        { index: true, element: <Navigate to="collabs" replace /> },
        { path: 'onboarding/username', element: <UsernameOnboarding />, handle: { title: 'Choose Username', breadcrumb: 'Username' } },
        {
          path: 'collabs',
          element: <DashboardView />,
          handle: {
            title: '',
            breadcrumb: 'home page',
            actions: ({ navigate }: any) => ([{ key: 'to-auth', label: 'Login', onClick: () => navigate('auth') }])
          }
        },
        {
          path: 'project/:projectId',
          element: <ProjectEditView />,
          handle: {
            title: 'Project',
            breadcrumb: 'Project',
            actions: ({ navigate: nav, project }: any) => ([
              { key: 'back', label: 'Back', onClick: () => nav('/collabs') },
              project ? {
                key: 'delete',
                label: 'Delete Project',
                onClick: async () => {
                  const ok = window.confirm('Delete this project? This cannot be undone.');
                  if (!ok) return;
                  try {
                    await ProjectService.deleteProject(project.id);
                    nav('/collabs');
                  } catch (e) {
                    alert('Failed to delete project');
                  }
                }
              } : null
            ].filter(Boolean))
          }
        },
        {
          path: 'collab/:collaborationId',
          element: <VotingView key={user?.uid || 'anonymous'} />,
          handle: {
            title: 'Collaboration',
            breadcrumb: 'Collaboration',
            actions: ({ navigate, params, collab }: any) => ([
              { key: 'back', label: 'Back', onClick: () => navigate('/collabs') },
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
            actions: ({ navigate }: any) => ([{ key: 'back', label: 'Back', onClick: () => navigate('/collabs') }])
          }
        },
        {
          path: 'collab/:collaborationId/completed',
          element: <CompletedView />,
          handle: {
            title: 'Completed',
            breadcrumb: 'Completed',
            actions: ({ navigate, params }: any) => ([
              { key: 'back', label: 'Back', onClick: () => navigate('/collabs') },
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
            actions: ({ navigate }: any) => ([
              { key: 'back', label: 'Back', onClick: () => navigate('/collabs') }
            ])
          }
        },
        {
          path: 'admin/tags',
          element: <AdminRoute><AdminTagsView /></AdminRoute>,
          handle: {
            title: 'Manage Tags',
            breadcrumb: 'Tags',
            actions: ({ navigate }: any) => ([{ key: 'back', label: 'Back', onClick: () => navigate('/collabs') }])
          }
        },
        {
          path: 'admin/projects',
          element: <AdminRoute><AdminProjectsView /></AdminRoute>,
          handle: {
            title: 'Manage Projects',
            breadcrumb: 'Projects',
            actions: ({ navigate }: any) => ([{ key: 'back', label: 'Back', onClick: () => navigate('/collabs') }])
          }
        },
        {
          path: 'admin/reported',
          element: <AdminRoute><AdminReportedView /></AdminRoute>,
          handle: {
            title: 'Reported Submissions',
            breadcrumb: 'Reported',
            actions: ({ navigate }: any) => ([{ key: 'back', label: 'Back', onClick: () => navigate('/collabs') }])
          }
        },
        {
          path: 'admin/resolved',
          element: <AdminRoute><AdminResolvedReportsView /></AdminRoute>,
          handle: {
            title: 'Resolved Reports',
            breadcrumb: 'Resolved',
            actions: ({ navigate }: any) => ([{ key: 'back', label: 'Back', onClick: () => navigate('/collabs') }])
          }
        },
        {
          path: 'admin/feedback',
          element: <AdminRoute><AdminFeedbackView /></AdminRoute>,
          handle: {
            title: 'User Feedback',
            breadcrumb: 'Feedback',
            actions: ({ navigate }: any) => ([{ key: 'back', label: 'Back', onClick: () => navigate('/collabs') }])
          }
        },
        {
          path: 'admin/users',
          element: <AdminRoute><AdminUsersView /></AdminRoute>,
          handle: {
            title: 'User Management',
            breadcrumb: 'Users',
            actions: ({ navigate }: any) => ([{ key: 'back', label: 'Back', onClick: () => navigate('/collabs') }])
          }
        },
        {
          path: 'admin/settings',
          element: <AdminRoute><AdminSettingsView /></AdminRoute>,
          handle: {
            title: 'Global Settings',
            breadcrumb: 'Settings',
            actions: ({ navigate }: any) => ([{ key: 'back', label: 'Back', onClick: () => navigate('/collabs') }])
          }
        },
        {
          path: 'access-denied',
          element: <AccessDeniedView />,
          handle: {
            title: 'Access Denied',
            breadcrumb: 'Access Denied'
          }
        },
        { path: '*', element: <Navigate to="/collabs" replace /> }
      ]
    },
    { path: '/auth', element: <AuthRoute /> }
  ]);

  return <RouterProvider router={router} />;
}

export default App
