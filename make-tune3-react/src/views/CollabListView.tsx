import { useEffect, useState } from 'react';
import type { Collaboration } from '../types/collaboration';
import { CollaborationService } from '../services/collaborationService';
import { useNavigate } from 'react-router-dom';
import '../components/ProjectHistory.css';
import { MyProjects } from '../components/MyProjects';

export function CollabListView() {
  const [collabs, setCollabs] = useState<Collaboration[]>([]);
  const [needsMod, setNeedsMod] = useState<Collaboration[]>([]);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const list = await CollaborationService.listPublishedCollaborations();
        if (mounted) {
          setCollabs(list);
          setNeedsMod(list.filter(c => c.needsModeration));
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

  const navigateTo = (path: string) => navigate(path);

  // always render view; hydrate when data arrives

  return (
    <div style={{ padding: 24, display: 'flex', gap: 16 }}>
      <MyProjects />
      <div className="project-history" style={{ maxWidth: 420, width: '100%' }}>
        <h4 className="project-history-title">collaborations</h4>
        <div className="collab-list" aria-busy={!hasLoaded}>
          {error && (
            <div style={{ color: 'var(--white)' }}>{error}</div>
          )}
          {hasLoaded && !error && collabs.length === 0 && (
            <div style={{ color: 'var(--white)' }}>no collaborations</div>
          )}
          {collabs.map(c => (
            <div 
              key={c.id}
              className="collab-history-item"
              onClick={() => navigateTo(c.status === 'submission' ? `/collab/${c.id}/submit` : `/collab/${c.id}`)}
            >
              <div className="collab-status-indicator">○</div>
              <div className="collab-info">
                <span className="collab-name">{c.name}</span>
                <span className="collab-stage">{c.status}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="project-history" style={{ maxWidth: 420, width: '100%' }}>
        <h4 className="project-history-title">to moderate</h4>
        <div className="collab-list" aria-busy={!hasLoaded}>
          {hasLoaded && needsMod.length === 0 && (
            <div style={{ color: 'var(--white)' }}>no pending moderation</div>
          )}
          {needsMod.map(c => (
            <div 
              key={c.id}
              className="collab-history-item"
              onClick={() => navigate(`/collab/${c.id}/moderate`)}
            >
              <div className="collab-status-indicator">●</div>
              <div className="collab-info">
                <span className="collab-name">{c.name}</span>
                <span className="collab-stage">pending</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

