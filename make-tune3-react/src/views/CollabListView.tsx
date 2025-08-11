import { useEffect, useState } from 'react';
import type { Collaboration } from '../types/collaboration';
import { CollaborationService } from '../services/collaborationService';
import { Link } from 'react-router-dom';
import '../components/ProjectHistory.css';
import { MyProjects } from '../components/MyProjects';

export function CollabListView() {
  const [collabs, setCollabs] = useState<Collaboration[]>([]);
  const [needsMod, setNeedsMod] = useState<Collaboration[]>([]);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const list = await CollaborationService.listPublishedCollaborations();
        if (mounted) {
          setCollabs(list);
          setNeedsMod(list.filter(c => (c as any).unmoderatedSubmissions));
        }
      } catch (e: any) {
        if (mounted) setError(e?.message || 'failed to load');
      } finally {
        if (mounted) setHasLoaded(true);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // removed direct navigate wrapper; using <Link to> below

  // always render view; hydrate when data arrives

  return (
    <div className="row gap-16" style={{ padding: 24 }}>
      <MyProjects />
      <div className="project-history card" style={{ maxWidth: 420, width: '100%' }}>
        <h4 className="project-history-title card__title">collaborations</h4>
        <div className="collab-list list" aria-busy={!hasLoaded}>
          {error && (
            <div style={{ color: 'var(--white)' }}>{error}</div>
          )}
          {hasLoaded && !error && collabs.length === 0 && (
            <div style={{ color: 'var(--white)' }}>no collaborations</div>
          )}
          {collabs.map(c => {
            const s = String(c.status || '').toLowerCase().trim();
            const id = encodeURIComponent(c.id);
            const to = s === 'submission' ? `/collab/${id}/submit` : `/collab/${id}`;
            return (
              <Link key={c.id} to={to} className="collab-history-item list__item">
                <div className="collab-info" style={{ display: 'flex', flexDirection: 'column' }}>
                  <span className="collab-name list__title">{c.name}</span>
                  <span className="collab-stage list__subtitle">{c.status}</span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
      <div className="project-history card" style={{ maxWidth: 420, width: '100%' }}>
        <h4 className="project-history-title card__title">to moderate</h4>
        <div className="collab-list list" aria-busy={!hasLoaded}>
          {hasLoaded && needsMod.length === 0 && (
            <div style={{ color: 'var(--white)' }}>no pending moderation</div>
          )}
          {needsMod.map(c => (
            <Link key={c.id} to={`/collab/${encodeURIComponent(c.id)}/moderate`} className="collab-history-item list__item">
              <div className="collab-info" style={{ display: 'flex', flexDirection: 'column' }}>
                <span className="collab-name list__title">{c.name}</span>
                <span className="collab-stage list__subtitle">pending</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

