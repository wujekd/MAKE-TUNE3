import { useContext, useMemo, useRef, useEffect } from 'react';
import { AudioEngineContext } from '../audio-services/AudioEngineContext';
import type { Track } from '../types/collaboration';
import './Favorites.css';

type Props = {
  tracks: Track[];
  onApprove: (track: Track) => void;
  onReject: (track: Track) => void;
};

export function ModerationPanel({ tracks, onApprove, onReject }: Props) {
  const ctx = useContext(AudioEngineContext);
  if (!ctx) return null;
  const { state } = ctx;
  const currentSrc = state.player1.source;
  const normalizeSource = (src: string): string => {
    if (!src) return '';
    if (src.startsWith('/test-audio/')) {
      return src.replace('/test-audio/', '');
    }
    if (src.startsWith('http')) {
      const idx = src.indexOf('/o/');
      if (idx !== -1) {
        let rest = src.substring(idx + 3);
        const q = rest.indexOf('?');
        if (q !== -1) rest = rest.substring(0, q);
        try {
          return decodeURIComponent(rest);
        } catch {
          return rest;
        }
      }
      return src;
    }
    return src;
  };

  const current = useMemo(() => {
    if (!currentSrc) return null;
    const sourcePath = normalizeSource(currentSrc);
    return tracks.find(t => t.filePath === sourcePath || t.optimizedPath === sourcePath) || null;
  }, [currentSrc, tracks]);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      el.scrollLeft += e.deltaY;
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  return (
    <section className="favorites-section">
      <div className="favorites-header">
        <h2 className="favorites-title">moderation</h2>
      </div>
      <div className="favorites-container" ref={scrollContainerRef}>
        {current ? (
          <div className="favorite-item" style={{ width: '100%' }}>
            <div className="moderation-actions">
              <button className="moderation-button moderation-reject" onClick={() => onReject(current)}>Reject</button>
              <button className="moderation-button moderation-approve" onClick={() => onApprove(current)}>Approve</button>
            </div>
            <div style={{ color: 'var(--white)', paddingTop: 8 }}>{current.title || current.filePath}</div>
          </div>
        ) : tracks.length === 0 ? (
          <div className="no-favorites">
            <p>all submissions moderated</p>
          </div>
        ) : (
          <div className="no-favorites">
            <p>play a pending submission to moderate</p>
          </div>
        )}
      </div>
    </section>
  );
}
