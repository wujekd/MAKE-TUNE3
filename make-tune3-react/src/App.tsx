import { Suspense, lazy, useEffect } from 'react';
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
import { DashboardView } from './views/DashboardView'
import { useAppStore } from './stores/appStore'
import { useUIStore } from './stores'
import { AppShell } from './components/AppShell';
import { AudioRouteBoundary } from './components/AudioRouteBoundary';
import { AdminRoute } from './components/AdminRoute';
import { OnboardingGate } from './components/OnboardingGate';
import { UsernameOnboarding } from './views/UsernameOnboarding';
import { AccessDeniedView } from './views/AccessDeniedView';
import { ProjectService } from './services';
import { RootErrorView } from './components/RootErrorView';
import { LoadingSpinner } from './components/LoadingSpinner';

const importVotingView = () => import('./views/VotingView');
const importProjectEditView = () => import('./views/ProjectEditView');
const importSubmissionView = () => import('./views/SubmissionView');
const importCompletedView = () => import('./views/CompletedView');
const importAuthRoute = () => import('./components/AuthRoute');

const VotingView = lazy(() =>
  importVotingView().then(module => ({ default: module.VotingView }))
);
const ProjectEditView = lazy(() =>
  importProjectEditView().then(module => ({ default: module.ProjectEditView }))
);
const SubmissionView = lazy(() =>
  importSubmissionView().then(module => ({ default: module.SubmissionView }))
);
const CompletedView = lazy(() =>
  importCompletedView().then(module => ({ default: module.CompletedView }))
);
const AuthRoute = lazy(() =>
  importAuthRoute().then(module => ({ default: module.AuthRoute }))
);
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
const AdminInteractionEventsView = lazy(() =>
  import('./views/AdminInteractionEventsView').then(module => ({ default: module.AdminInteractionEventsView }))
);
const AdminUsersView = lazy(() =>
  import('./views/AdminUsersView').then(module => ({ default: module.AdminUsersView }))
);
const AdminSettingsView = lazy(() =>
  import('./views/AdminSettingsView').then(module => ({ default: module.AdminSettingsView }))
);
const AdminHsdTestView = lazy(() =>
  import('./views/AdminHsdTestView').then(module => ({ default: module.AdminHsdTestView }))
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

function LazyRoute({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<RouteLoadingFallback />}>{children}</Suspense>;
}

export function VotingRoute() {
  const userId = useAppStore(state => state.auth.user?.uid);
  return <VotingView key={userId || 'anonymous'} />;
}

export function createProjectRouteActions({ navigate: nav, project }: any) {
  return ([
    { key: 'back', label: 'Back', onClick: () => nav('/collabs') },
    project ? {
      key: 'delete',
      label: 'Delete Project',
      onClick: async () => {
        const ok = window.confirm('Delete this project? This cannot be undone.');
        if (!ok) return;
        const currentUser = useAppStore.getState().auth.user;
        try {
          await ProjectService.deleteProject(project.id);
          if (currentUser?.uid && project?.ownerId === currentUser.uid) {
            try {
              const projects = await ProjectService.listUserProjects(currentUser.uid);
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
  ].filter(Boolean));
}

const router = createBrowserRouter([
  {
    element: <AppShell />,
    errorElement: <RootErrorView />,
    children: [
      { path: 'onboarding/username', element: <UsernameOnboarding />, handle: { title: 'Choose Username', breadcrumb: 'Username' } },
      {
        element: <OnboardingGate />,
        children: [
          { index: true, element: <Navigate to="collabs" replace /> },
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
            element: (
              <AudioRouteBoundary defer>
                <LazyRoute>
                  <ProjectEditView />
                </LazyRoute>
              </AudioRouteBoundary>
            ),
            handle: {
              title: 'Project',
              breadcrumb: 'Project',
              actions: createProjectRouteActions
            }
          },
          {
            path: 'collab/:collabId',
            element: (
              <AudioRouteBoundary fallback={<RouteLoadingFallback />}>
                <LazyRoute>
                  <VotingRoute />
                </LazyRoute>
              </AudioRouteBoundary>
            ),
            handle: {
              title: 'Voting',
              breadcrumb: 'Voting',
              actions: ({ navigate, params, collab }: any) => ([
                { key: 'back', label: 'Back', onClick: () => navigate('/collabs') },
                collab?.status === 'submission' ? { key: 'to-submit', label: 'Submit', onClick: () => navigate(`/collab/${params.collabId}/submit`) } : null
              ].filter(Boolean))
            }
          },
          {
            path: 'collab/:collabId/moderate',
            element: (
              <AudioRouteBoundary fallback={<RouteLoadingFallback />}>
                <Suspense fallback={<RouteLoadingFallback />}>
                  <ModerationView />
                </Suspense>
              </AudioRouteBoundary>
            ),
            handle: {
              title: 'Moderation',
              breadcrumb: 'Moderation',
              actions: ({ navigate }: any) => ([{ key: 'back', label: 'Back', onClick: () => navigate('/collabs') }])
            }
          },
          {
            path: 'collab/:collabId/completed',
            element: (
              <AudioRouteBoundary fallback={<RouteLoadingFallback />}>
                <LazyRoute>
                  <CompletedView />
                </LazyRoute>
              </AudioRouteBoundary>
            ),
            handle: {
              title: 'Completed',
              breadcrumb: 'Completed',
              actions: ({ navigate, params }: any) => ([
                { key: 'back', label: 'Back', onClick: () => navigate('/collabs') },
                { key: 'to-collab', label: 'Open collab', onClick: () => navigate(`/collab/${params.collabId}`) }
              ])
            }
          },
          {
            path: 'collab/:collabId/submit',
            element: (
              <AudioRouteBoundary fallback={<RouteLoadingFallback />}>
                <LazyRoute>
                  <SubmissionView />
                </LazyRoute>
              </AudioRouteBoundary>
            ),
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
            path: 'admin/events',
            element: <LazyAdminRoute><AdminInteractionEventsView /></LazyAdminRoute>,
            handle: {
              title: 'Interaction Events',
              breadcrumb: 'Events',
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
            path: 'admin/hsd',
            element: <LazyAdminRoute><AdminHsdTestView /></LazyAdminRoute>,
            handle: {
              title: 'HSD Tester',
              breadcrumb: 'HSD',
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
      }
    ]
  },
  {
    path: '/auth',
    element: (
      <LazyRoute>
        <AuthRoute />
      </LazyRoute>
    )
  }
]);

function App() {
  const user = useAppStore(state => state.auth.user);
  const loading = useAppStore(state => state.auth.loading);
  const setShowAuth = useUIStore(state => state.setShowAuth);

  useEffect(() => {
    // console.log('app render - user:', user?.email, 'loading:', loading);
  }, [user, loading]);

  // hide auth view when user logs in successfully
  useEffect(() => {
    if (user) {
      setShowAuth(false);
    }
  }, [user, setShowAuth]);

  useEffect(() => {
    let cancelled = false;

    const prefetchRoutes = () => {
      if (cancelled) return;
      void importVotingView();
      void importSubmissionView();
      void importCompletedView();
    };

    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      const idleId = window.requestIdleCallback(() => {
        prefetchRoutes();
      }, { timeout: 1500 });

      return () => {
        cancelled = true;
        window.cancelIdleCallback(idleId);
      };
    }

    const timeoutId = globalThis.setTimeout(() => {
      prefetchRoutes();
    }, 1200);

    return () => {
      cancelled = true;
      globalThis.clearTimeout(timeoutId);
    };
  }, []);

  return <RouterProvider router={router} />;
}

export default App
