import { useContext, useMemo, useState } from 'react';
import { AudioEngineContext } from '../audio-services/AudioEngineContext';
import type { Track } from '../types/collaboration';
import { ReportService } from '../services';
import { useAppStore } from '../stores/appStore';
import styles from './ModerationPanel.module.css';

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
      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <div className={styles.panelHeading}>
            <span className={styles.panelTitle}>Moderation</span>
            <span className={styles.panelCount}>{tracks.length} pending</span>
          </div>
          {current && <span className={styles.statusPill}>Now reviewing</span>}
        </div>

        {current ? (
          <div className={styles.trackRow}>
            <div className={styles.trackInfo}>
              <div className={styles.trackTitle}>{current.title || 'Untitled submission'}</div>
              <div className={styles.trackMeta}>{current.filePath}</div>
            </div>
            <div className={styles.actions}>
              <button
                className={`${styles.actionButton} ${styles.reject}`}
                onClick={handleReject}
              >
                Reject
              </button>
              <button
                className={`${styles.actionButton} ${styles.approve}`}
                onClick={handleApprove}
              >
                Approve
              </button>
              {user && (
                <button
                  className={`${styles.actionButton} ${styles.report}`}
                  onClick={handleReportClick}
                >
                  Report
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className={styles.emptyState}>
            {tracks.length === 0 ? 'All submissions moderated' : 'Play a pending submission to moderate'}
          </div>
        )}
      </section>

      {showReportModal && (
        <div className={styles.reportOverlay} onClick={() => setShowReportModal(false)}>
          <div className={styles.reportModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.reportHeader}>
              <h3 className={styles.reportTitle}>Report Submission</h3>
              <button
                className={styles.reportClose}
                onClick={() => setShowReportModal(false)}
                disabled={reporting}
              >
                ×
              </button>
            </div>
            <div className={styles.reportBody}>
              <p className={styles.reportText}>
                Please describe why you are reporting this submission:
              </p>
              <textarea
                className={styles.reportTextarea}
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                placeholder="Enter reason for reporting..."
              />
              <div className={styles.reportActions}>
                <button
                  onClick={() => setShowReportModal(false)}
                  disabled={reporting}
                  className={`${styles.reportButton} ${styles.reportCancel}`}
                >
                  Cancel
                </button>
                <button
                  onClick={handleReportSubmit}
                  disabled={reporting || !reportReason.trim()}
                  className={`${styles.reportButton} ${styles.reportSubmit}`}
                >
                  {reporting ? 'Submitting...' : 'Submit Report'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
