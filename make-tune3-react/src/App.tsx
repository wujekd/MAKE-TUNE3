import { Suspense, lazy, useEffect } from 'react';
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
import { VotingView } from './views/VotingView'
import { DashboardView } from './views/DashboardView'
import { ProjectEditView } from './views/ProjectEditView'
import { SubmissionView } from './views/SubmissionView'
import { useAppStore } from './stores/appStore'
import { useUIStore } from './stores'
import { AppShell } from './components/AppShell';
import { AuthRoute } from './components/AuthRoute';
import { AdminRoute } from './components/AdminRoute';
import { CompletedView } from './views/CompletedView';
import { UsernameOnboarding } from './views/UsernameOnboarding';
import { AccessDeniedView } from './views/AccessDeniedView';
import { ProjectService } from './services';
import { RootErrorView } from './components/RootErrorView';
import { LoadingSpinner } from './components/LoadingSpinner';

const ModerationView = lazy(() =>
  import('./views/ModerationView').then(module => ({ default: module.ModerationView }))
);
const MyAccountView = lazy(() =>
  import('./views/MyAccountView').then(module => ({ default: module.MyAccountView }))
);
const AdminTagsView = lazy(() =>
  import('./views/AdminTagsView').then(module => ({ default: module.AdminTagsView }))
);
const AdminProjectsView = lazy(() =>
  import('./views/AdminProjectsView').then(module => ({ default: module.AdminProjectsView }))
);
const AdminReportedView = lazy(() =>
  import('./views/AdminReportedView').then(module => ({ default: module.AdminReportedView }))
);
const AdminResolvedReportsView = lazy(() =>
  import('./views/AdminResolvedReportsView').then(module => ({ default: module.AdminResolvedReportsView }))
);
const AdminFeedbackView = lazy(() =>
  import('./views/AdminFeedbackView').then(module => ({ default: module.AdminFeedbackView }))
);
const AdminUsersView = lazy(() =>
  import('./views/AdminUsersView').then(module => ({ default: module.AdminUsersView }))
);
const AdminSettingsView = lazy(() =>
  import('./views/AdminSettingsView').then(module => ({ default: module.AdminSettingsView }))
);

function RouteLoadingFallback() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '32px 16px' }}>
      <LoadingSpinner size={24} />
    </div>
  );
}

function LazyAdminRoute({ children }: { children: React.ReactNode }) {
  return (
    <AdminRoute>
      <Suspense fallback={<RouteLoadingFallback />}>{children}</Suspense>
    </AdminRoute>
  );
}

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
                    if (user?.uid && project?.ownerId === user.uid) {
                      try {
                        const projects = await ProjectService.listUserProjects(user.uid);
                        useAppStore.setState(state => ({
                          auth: {
                            ...state.auth,
                            user: state.auth.user ? {
                              ...state.auth.user,
                              projectCount: projects.length
                            } : null
                          }
                        }));
                      } catch (err) {
                        console.warn('Failed to refresh project count after delete', err);
                      }
                    }
                    nav('/collabs');
                  } catch {
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
            title: 'Voting',
            breadcrumb: 'Voting',
            actions: ({ navigate, params, collab }: any) => ([
              { key: 'back', label: 'Back', onClick: () => navigate('/collabs') },
              collab?.status === 'submission' ? { key: 'to-submit', label: 'Submit', onClick: () => navigate(`/collab/${params.collaborationId}/submit`) } : null
            ].filter(Boolean))
          }
        },
        {
          path: 'collab/:collaborationId/moderate',
          element: (
            <Suspense fallback={<RouteLoadingFallback />}>
              <ModerationView />
            </Suspense>
          ),
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
          element: <LazyAdminRoute><AdminTagsView /></LazyAdminRoute>,
          handle: {
            title: 'Manage Tags',
            breadcrumb: 'Tags',
            actions: ({ navigate }: any) => ([{ key: 'back', label: 'Back', onClick: () => navigate('/collabs') }])
          }
        },
        {
          path: 'admin/projects',
          element: <LazyAdminRoute><AdminProjectsView /></LazyAdminRoute>,
          handle: {
            title: 'Manage Projects',
            breadcrumb: 'Projects',
            actions: ({ navigate }: any) => ([{ key: 'back', label: 'Back', onClick: () => navigate('/collabs') }])
          }
        },
        {
          path: 'admin/reported',
          element: <LazyAdminRoute><AdminReportedView /></LazyAdminRoute>,
          handle: {
            title: 'Reported Submissions',
            breadcrumb: 'Reported',
            actions: ({ navigate }: any) => ([{ key: 'back', label: 'Back', onClick: () => navigate('/collabs') }])
          }
        },
        {
          path: 'admin/resolved',
          element: <LazyAdminRoute><AdminResolvedReportsView /></LazyAdminRoute>,
          handle: {
            title: 'Resolved Reports',
            breadcrumb: 'Resolved',
            actions: ({ navigate }: any) => ([{ key: 'back', label: 'Back', onClick: () => navigate('/collabs') }])
          }
        },
        {
          path: 'admin/feedback',
          element: <LazyAdminRoute><AdminFeedbackView /></LazyAdminRoute>,
          handle: {
            title: 'User Feedback',
            breadcrumb: 'Feedback',
            actions: ({ navigate }: any) => ([{ key: 'back', label: 'Back', onClick: () => navigate('/collabs') }])
          }
        },
        {
          path: 'admin/users',
          element: <LazyAdminRoute><AdminUsersView /></LazyAdminRoute>,
          handle: {
            title: 'User Management',
            breadcrumb: 'Users',
            actions: ({ navigate }: any) => ([{ key: 'back', label: 'Back', onClick: () => navigate('/collabs') }])
          }
        },
        {
          path: 'admin/settings',
          element: <LazyAdminRoute><AdminSettingsView /></LazyAdminRoute>,
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
        {
          path: 'account',
          element: (
            <Suspense fallback={<RouteLoadingFallback />}>
              <MyAccountView />
            </Suspense>
          ),
          handle: {
            title: 'My Account',
            breadcrumb: 'My Account',
            actions: ({ navigate }: any) => ([
              { key: 'back', label: 'Back', onClick: () => navigate('/collabs') }
            ])
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
