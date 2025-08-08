import { useContext, useMemo, useRef, useEffect } from 'react';
import { AudioEngineContext } from '../audio-services/AudioEngineContext';
import type { Track } from '../types/collaboration';
import './Favorites.css';

type Props = {
  tracks: Track[];
  onApprove: (filePath: string) => void;
  onReject: (filePath: string) => void;
};

export function ModerationPanel({ tracks, onApprove, onReject }: Props) {
  const ctx = useContext(AudioEngineContext);
  if (!ctx) return null;
  const { state } = ctx;
  const currentSrc = state.player1.source;
  const current = useMemo(() => {
    if (!currentSrc) return null;
    const fp = currentSrc.replace('/test-audio/', '');
    return tracks.find(t => t.filePath === fp) || null;
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
          <div className="favorite-item">
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="remove-button" onClick={() => onReject(current.filePath)}>×</button>
              <button onClick={() => onApprove(current.filePath)} style={{ padding: '6px 10px' }}>approve</button>
            </div>
            <div style={{ color: 'var(--white)', paddingTop: 8 }}>{current.title || current.filePath}</div>
          </div>
        ) : (
          <div className="no-favorites">
            <p>play a submission to moderate</p>
          </div>
        )}
      </div>
    </section>
  );
}

