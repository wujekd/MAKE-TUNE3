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
        <Outlet />
      </div>
    </div>
  );
}

