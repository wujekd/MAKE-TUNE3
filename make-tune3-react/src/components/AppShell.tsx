import { Outlet, useMatches, useNavigate, useParams } from 'react-router-dom';
import { useAppStore } from '../stores/appStore';

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
  const actions: Action[] = typeof handle.actions === 'function' ? (handle.actions(ctx) || []) : (handle.actions || []);
  return { title, crumbs, actions };
}

export function AppShell() {
  const { title, crumbs, actions } = useToolbar();
  return (
    <div className="app-shell" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
          <nav style={{ fontSize: 12, opacity: 0.75, color: 'var(--white)' }}>
            {crumbs.join(' / ')}
          </nav>
          <h3 style={{ margin: 0, color: 'var(--white)' }}>{title}</h3>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {actions.filter(a => a.visible !== false).map(a => (
            <button key={a.key} onClick={a.onClick} disabled={a.disabled}>{a.label}</button>
          ))}
        </div>
      </header>
      <div style={{ flex: 1, minHeight: 0 }}>
        <Outlet />
      </div>
    </div>
  );
}

