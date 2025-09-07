import { Outlet, useMatches, useNavigate, useParams } from 'react-router-dom';
import { useAppStore } from '../stores/appStore';
import './AppShell.css';
import { useState } from 'react';
import { DebugInfo } from './DebugInfo';
import { StorePanel } from './StorePanel';

type Action = { key: string; label: string; onClick: () => void; visible?: boolean; disabled?: boolean };

export function useToolbar() {
  const matches = useMatches();
  const navigate = useNavigate();
  const params = useParams();
  const user = useAppStore(s => s.auth.user);
  const collab = useAppStore(s => s.collaboration.currentCollaboration);
  const project = useAppStore(s => s.collaboration.currentProject);

  const ctx = { navigate, params, user, collab, project };
  const deepest = matches[matches.length - 1];
  const handle: any = deepest?.handle || {};

  const title = typeof handle.title === 'function' ? handle.title(ctx) : (handle.title || '');
  const crumbs: string[] = matches.map(m => typeof (m as any).handle?.breadcrumb === 'function'
    ? (m as any).handle.breadcrumb(ctx)
    : ((m as any).handle?.breadcrumb || '')).filter(Boolean);
  const routeActionsRaw: Action[] = typeof handle.actions === 'function' ? (handle.actions(ctx) || []) : (handle.actions || []);
  const routeActions: Action[] = routeActionsRaw.filter(a => !['login','register','logout','to-auth'].includes(a.key));

  const signOut = useAppStore(s => s.auth.signOut);
  const authActions: Action[] = user
    ? [
        { key: 'logout', label: 'Logout', onClick: async () => { try { await signOut(); } finally { navigate('/collabs'); } } }
      ]
    : [
        { key: 'login', label: 'Login', onClick: () => navigate('/auth?mode=login') },
        { key: 'register', label: 'Register', onClick: () => navigate('/auth?mode=register') }
      ];

  return { title, crumbs, actions: [...routeActions, ...authActions] };
}

export function AppShell() {
  const { title, crumbs, actions } = useToolbar();
  const currentUser = useAppStore(s => s.auth.user);
  const signInWithGoogle = useAppStore(s => s.auth.signInWithGoogle);
  // no-op
  const proj = useAppStore(s => s.collaboration.currentProject);
  const collab = useAppStore(s => s.collaboration.currentCollaboration);
  const [showDebug, setShowDebug] = useState(false);
  const [showStore, setShowStore] = useState(false);
  const backAction = actions.find(a => a.key === 'back');
  const rightActions = actions.filter(a => a.key !== 'back');
  const headerTitle = (proj?.name || collab?.name) ? [proj?.name, collab?.name].filter(Boolean).join(' / ') : title;

  return (
    <div className="app-shell" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <header className="app-shell__header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {backAction && (
            <button key={backAction.key} onClick={backAction.onClick} disabled={backAction.disabled}>{backAction.label}</button>
          )}
          <nav style={{ fontSize: 12, opacity: 0.75, color: 'var(--white)' }}>
            {crumbs.join(' / ')}
          </nav>
          <h3 style={{ margin: 0, color: 'var(--white)' }}>{headerTitle}</h3>
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, flex: 1 }}>
          <button onClick={() => setShowStore(v => !v)}>{showStore ? 'Hide store' : 'Show store'}</button>
          <button onClick={() => setShowDebug(v => !v)}>{showDebug ? 'Hide debug' : 'Show debug'}</button>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {currentUser && (
            <span style={{ color: 'var(--white)', opacity: 0.85, fontSize: 12 }}>hello: {currentUser.email}</span>
          )}
          {!currentUser && (
            <button
              className="gsi-material-button"
              style={{ height: 32, borderRadius: 16, padding: '0 8px', width: 'auto' as any }}
              onClick={async () => { try { await signInWithGoogle(); } catch {} }}
              aria-label="Sign in with Google"
            >
              <div className="gsi-material-button-state"></div>
              <div className="gsi-material-button-content-wrapper">
                <div className="gsi-material-button-icon">
                  <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" style={{ display: 'block', height: 16, width: 16 }}>
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                    <path fill="none" d="M0 0h48v48H0z"></path>
                  </svg>
                </div>
                <span className="gsi-material-button-contents" style={{ fontSize: 12 }}>Sign in</span>
                <span style={{ display: 'none' }}>Sign in with Google</span>
              </div>
            </button>
          )}
          {rightActions.filter(a => a.visible !== false).map(a => (
            <button key={a.key} onClick={a.onClick} disabled={a.disabled}>{a.label}</button>
          ))}
        </div>
      </header>
      <div className="app-shell__content" style={{ flex: 1, minHeight: 0 }}>
        {showDebug && (
          <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', zIndex: 1000, maxWidth: 640, width: '90%' }}>
            <DebugInfo />
          </div>
        )}
        {showStore && (
          <div style={{ position: 'absolute', top: 0, left: 8, zIndex: 1000, display: 'inline-block' }}>
            <StorePanel />
          </div>
        )}
        {!currentUser?.username && currentUser ? (
          <Outlet />
        ) : (
          <Outlet />
        )}
      </div>
    </div>
  );
}

