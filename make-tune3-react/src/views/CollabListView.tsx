import { useEffect, useState } from 'react';
import type { Collaboration } from '../types/collaboration';
import { CollaborationService } from '../services';
import { Link } from 'react-router-dom';
import '../components/ProjectHistory.css';
import { MyProjects } from '../components/MyProjects';
import { TagFilter } from '../components/TagFilter';

export function CollabListView() {
  const [allCollabs, setAllCollabs] = useState<Collaboration[]>([]);
  const [filteredCollabs, setFilteredCollabs] = useState<Collaboration[]>([]);
  const [needsMod, setNeedsMod] = useState<Collaboration[]>([]);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        console.log('CollabListView: fetching all collaborations...');
        const list = await CollaborationService.listAllCollaborations();
        console.log('CollabListView: received', list.length, 'collaborations:', list);
        if (mounted) {
          setAllCollabs(list);
          setFilteredCollabs(list);
          setNeedsMod(list.filter(c => (c as any).unmoderatedSubmissions));
        }
      } catch (e: any) {
        console.error('CollabListView: error loading collaborations:', e);
        console.error('CollabListView: error code:', e?.code);
        console.error('CollabListView: error message:', e?.message);
        if (mounted) setError(e?.message || 'failed to load');
      } finally {
        if (mounted) setHasLoaded(true);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (selectedTags.length === 0) {
      setFilteredCollabs(allCollabs);
    } else {
      const filtered = CollaborationService.filterCollaborationsByTags(allCollabs, selectedTags);
      setFilteredCollabs(filtered);
    }
  }, [selectedTags, allCollabs]);

  const handleTagsChange = (tagKeys: string[]) => {
    setSelectedTags(tagKeys);
  };

  // removed direct navigate wrapper; using <Link to> below

  // always render view; hydrate when data arrives

  return (
    <div className="row gap-16" style={{ padding: 24, background: 'var(--primary1-800)', minHeight: '100%', width: '100%', boxSizing: 'border-box', alignItems: 'flex-start' }}>
      <MyProjects />
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, flex: 1 }}>
        <TagFilter selectedTags={selectedTags} onTagsChange={handleTagsChange} />
        
        <div className="project-history card" style={{ maxWidth: 420, width: '100%' }}>
          <h4 className="project-history-title card__title">
            collaborations
            {selectedTags.length > 0 && ` (${filteredCollabs.length})`}
          </h4>
          <div className="collab-list list" aria-busy={!hasLoaded}>
            {error && (
              <div style={{ color: 'var(--white)' }}>{error}</div>
            )}
            {hasLoaded && !error && filteredCollabs.length === 0 && (
              <div style={{ color: 'var(--white)' }}>
                {selectedTags.length > 0 ? 'no collaborations with selected tags' : 'no collaborations'}
              </div>
            )}
            {filteredCollabs.map(c => {
              const s = String(c.status || '').toLowerCase().trim();
              const id = encodeURIComponent(c.id);
              const to = s === 'submission' ? `/collab/${id}/submit` : (s === 'completed' ? `/collab/${id}/completed` : `/collab/${id}`);
              return (
                <Link key={c.id} to={to} className="collab-history-item list__item">
                  <div className="collab-info" style={{ display: 'flex', flexDirection: 'column' }}>
                    <span className="collab-name list__title">{c.name}</span>
                    <span className="collab-stage list__subtitle">{c.status}</span>
                    {c.tags && c.tags.length > 0 && (
                      <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
                        {c.tags.map((tag, i) => (
                          <span key={i} style={{ 
                            fontSize: 11, 
                            background: 'var(--primary1-600)', 
                            padding: '2px 8px', 
                            borderRadius: 8,
                            opacity: 0.8
                          }}>
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
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

