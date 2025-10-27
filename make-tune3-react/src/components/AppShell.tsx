import { Outlet, useMatches, useNavigate, useParams } from 'react-router-dom';
import { useAppStore } from '../stores/appStore';
import './AppShell.css';
import { useEffect, useRef, useState } from 'react';
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
  const signOut = useAppStore(s => s.auth.signOut);
  const navigate = useNavigate();
  const proj = useAppStore(s => s.collaboration.currentProject);
  const collab = useAppStore(s => s.collaboration.currentCollaboration);
  const [showDebug, setShowDebug] = useState(false);
  const [showStore, setShowStore] = useState(false);
  const backAction = actions.find(a => a.key === 'back');
  const rightActions = actions.filter(a => a.key !== 'back' && a.key !== 'logout');
  const headerTitle = (proj?.name || collab?.name) ? [proj?.name, collab?.name].filter(Boolean).join(' / ') : title;

  const [showUserMenu, setShowUserMenu] = useState(false);
  const userBtnRef = useRef<HTMLButtonElement | null>(null);
  const userMenuRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (showUserMenu && userBtnRef.current && userMenuRef.current) {
        if (!userBtnRef.current.contains(t) && !userMenuRef.current.contains(t)) {
          setShowUserMenu(false);
        }
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowUserMenu(false);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [showUserMenu]);

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
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', position: 'relative' }}>
          {currentUser && (
            <div style={{ position: 'relative' }}>
              <button
                ref={userBtnRef as any}
                onClick={() => setShowUserMenu(v => !v)}
                style={{ fontSize: 12 }}
              >
                {currentUser.email}
              </button>
              {showUserMenu && (
                <div
                  ref={userMenuRef as any}
                  style={{
                    position: 'absolute',
                    right: 0,
                    top: 'calc(100% + 6px)',
                    background: 'var(--primary1-900)',
                    borderRadius: 8,
                    boxShadow: '0 6px 20px rgba(0,0,0,0.35), inset 0 2px 4px rgba(0,0,0,0.2)',
                    border: '1px solid var(--primary1-600)',
                    minWidth: 180,
                    zIndex: 2000,
                    overflow: 'hidden'
                  }}
                >
                  <button
                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--primary1-800)'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
                    onClick={() => { setShowUserMenu(false); }}
                    style={{
                      display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px',
                      background: 'transparent', color: 'var(--white)', border: 'none', fontSize: 12,
                      borderBottom: '1px solid var(--primary1-500)'
                    }}
                  >
                    Settings
                  </button>
                  <button
                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--primary1-800)'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
                    onClick={() => { setShowUserMenu(false); }}
                    style={{
                      display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px',
                      background: 'transparent', color: 'var(--white)', border: 'none', fontSize: 12,
                      borderBottom: '1px solid var(--primary1-500)'
                    }}
                  >
                    My account
                  </button>
                  <button
                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--primary1-800)'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
                    onClick={async () => {
                      setShowUserMenu(false);
                      try { await signOut(); } finally { navigate('/collabs'); }
                    }}
                    style={{
                      display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px',
                      background: 'transparent', color: 'var(--white)', border: 'none', fontSize: 12
                    }}
                  >
                    Logout
                  </button>
                </div>
              )}
            </div>
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

