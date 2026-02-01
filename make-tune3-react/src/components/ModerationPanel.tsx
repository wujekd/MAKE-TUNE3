import { useContext, useMemo, useRef, useEffect, useState } from 'react';
import { AudioEngineContext } from '../audio-services/AudioEngineContext';
import type { Track } from '../types/collaboration';
import { ReportService } from '../services';
import { useAppStore } from '../stores/appStore';
import './Favorites.css';

type Props = {
  tracks: Track[];
  onApprove: (track: Track) => void;
  onReject: (track: Track) => void;
};

export function ModerationPanel({ tracks, onApprove, onReject }: Props) {
  const ctx = useContext(AudioEngineContext);
  const { user } = useAppStore(state => state.auth);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reporting, setReporting] = useState(false);

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

  const handleReportClick = () => {
    if (!current) return;
    setShowReportModal(true);
    setReportReason('');
  };

  const handleReportSubmit = async () => {
    if (!user || !current || !current.collaborationId || !reportReason.trim()) return;

    setReporting(true);
    try {
      const alreadyReported = await ReportService.checkExistingReport(
        current.filePath,
        current.collaborationId,
        user.uid
      );

      if (alreadyReported) {
        alert('You have already reported this submission.');
        setShowReportModal(false);
        return;
      }

      await ReportService.createReport(
        current.filePath,
        current.collaborationId,
        user.uid,
        user.username,
        reportReason.trim()
      );

      alert('Report submitted successfully.');
      setShowReportModal(false);
    } catch (error) {
      alert('Failed to submit report. Please try again.');
    } finally {
      setReporting(false);
    }
  };

  const handleApprove = () => {
    if (!current) return;
    const confirmed = window.confirm(
      `Approve this submission?\n\n"${current.title || 'Untitled'}"\n\nApproved submissions will be visible to voters.`
    );
    if (confirmed) {
      onApprove(current);
    }
  };

  const handleReject = () => {
    if (!current) return;
    const confirmed = window.confirm(
      `Reject this submission?\n\n"${current.title || 'Untitled'}"\n\nRejected submissions will NOT be visible to voters and cannot be undone.`
    );
    if (confirmed) {
      onReject(current);
    }
  };

  return (
    <>
      <section className="favorites-section">
        <div className="favorites-header">
          <h2 className="favorites-title">moderation</h2>
        </div>
        <div className="favorites-container" ref={scrollContainerRef}>
          {current ? (
            <div className="favorite-item" style={{ width: '100%' }}>
              <div className="moderation-actions">
                <button className="moderation-button moderation-reject" onClick={handleReject}>Reject</button>
                <button className="moderation-button moderation-approve" onClick={handleApprove}>Approve</button>
                {user && (
                  <button
                    className="moderation-button moderation-report"
                    onClick={handleReportClick}
                  >
                    ⚠ Report
                  </button>
                )}
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

      {showReportModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000
        }}>
          <div style={{
            backgroundColor: 'var(--primary1-900)',
            borderRadius: '8px',
            padding: '2rem',
            maxWidth: '500px',
            width: '90%',
            border: '1px solid var(--contrast-600)'
          }}>
            <h3 style={{ color: 'var(--white)', marginTop: 0 }}>Report Submission</h3>
            <p style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '0.9rem' }}>
              Please describe why you are reporting this submission:
            </p>
            <textarea
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              placeholder="Enter reason for reporting..."
              style={{
                width: '100%',
                minHeight: '120px',
                padding: '0.75rem',
                borderRadius: '4px',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                backgroundColor: 'rgba(0, 0, 0, 0.3)',
                color: 'var(--white)',
                fontSize: '1rem',
                fontFamily: 'inherit',
                resize: 'vertical'
              }}
            />
            <div style={{
              display: 'flex',
              gap: '1rem',
              marginTop: '1.5rem'
            }}>
              <button
                onClick={() => setShowReportModal(false)}
                disabled={reporting}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  borderRadius: '4px',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  color: 'var(--white)',
                  cursor: reporting ? 'default' : 'pointer',
                  opacity: reporting ? 0.5 : 1
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleReportSubmit}
                disabled={reporting || !reportReason.trim()}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  borderRadius: '4px',
                  border: '1px solid rgba(200, 50, 50, 0.5)',
                  backgroundColor: 'rgba(200, 50, 50, 0.3)',
                  color: 'var(--white)',
                  cursor: reporting || !reportReason.trim() ? 'default' : 'pointer',
                  opacity: reporting || !reportReason.trim() ? 0.5 : 1
                }}
              >
                {reporting ? 'Submitting...' : 'Submit Report'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
