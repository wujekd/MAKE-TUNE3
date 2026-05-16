import { useCallback, useEffect, useState } from 'react';
import { FeedbackService } from '../services/feedbackService';
import { AdminService } from '../services';
import type { FeedbackCategory, FeedbackStatus } from '../services/feedbackService';
import { useAppStore } from '../stores/appStore';
import { AdminLayout } from '../components/AdminLayout';
import './AdminFeedbackView.css';

const CATEGORY_LABELS: Record<FeedbackCategory, string> = {
  bug: 'Bug',
  idea: 'Idea',
  ui: 'UI',
  creator_request: 'Creator Request',
  other: 'Other'
};

const STATUS_LABELS: Record<FeedbackStatus, string> = {
  new: 'New',
  reviewed: 'Reviewed',
  resolved: 'Resolved'
};

interface FeedbackDisplay {
  id: string;
  uid: string;
  createdAt: number | null;
  category: string;
  message: string;
  answers: any;
  status: string;
  adminNote: string | null;
  route: string;
}

export function AdminFeedbackView() {
  const user = useAppStore(state => state.auth.user);
  const [copiedUid, setCopiedUid] = useState<string | null>(null);

  const handleCopyUid = async (uid: string) => {
    try {
      await navigator.clipboard.writeText(uid);
      setCopiedUid(uid);
      setTimeout(() => setCopiedUid(null), 1500);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };
  const [feedback, setFeedback] = useState<FeedbackDisplay[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [noteInputs, setNoteInputs] = useState<Record<string, string>>({});

  const [filterCategory, setFilterCategory] = useState<FeedbackCategory | ''>('');
  const [filterStatus, setFilterStatus] = useState<FeedbackStatus | ''>('');

  const [pageTokens, setPageTokens] = useState<(string | null)[]>([null]);
  const [currentPage, setCurrentPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  const loadFeedback = useCallback(async (page: number, tokens: (string | null)[]) => {
    setLoading(true);
    try {
      const result = await AdminService.listFeedback(
        25,
        tokens[page] ?? null,
        filterCategory || null,
        filterStatus || null
      );
      setFeedback(result.feedback.map(f => ({
        id: f.id,
        uid: f.uid,
        createdAt: f.createdAt,
        category: f.category,
        message: f.message,
        answers: f.answers,
        status: f.status,
        adminNote: f.adminNote,
        route: f.route
      })));
      setHasMore(result.hasMore);

      const newTokens = [...tokens];
      if (result.nextPageToken) {
        newTokens[page + 1] = result.nextPageToken;
      }
      setPageTokens(newTokens);
      setCurrentPage(page);
    } catch (error) {
      console.error('Failed to load feedback:', error);
    } finally {
      setLoading(false);
    }
  }, [filterCategory, filterStatus]);

  useEffect(() => {
    setCurrentPage(0);
    setPageTokens([null]);
    loadFeedback(0, [null]);
  }, [loadFeedback]);

  const goToPage = (page: number) => {
    if (page < 0) return;
    loadFeedback(page, pageTokens);
  };

  const handleUpdateStatus = async (id: string, status: FeedbackStatus) => {
    setProcessing(id);
    try {
      const note = noteInputs[id];
      await FeedbackService.updateFeedbackStatus(id, status, note || undefined);
      await loadFeedback(currentPage, pageTokens);
    } catch (error) {
      console.error('Failed to update status:', error);
    } finally {
      setProcessing(null);
    }
  };

  const handleGrantAccess = async (item: FeedbackDisplay) => {
    const confirmed = window.confirm(
      `Grant creator access to user ${item.uid}? This will add 1 bonus project allowance.`
    );
    if (!confirmed) return;

    setProcessing(item.id);
    try {
      await FeedbackService.grantCreatorAccess(item.uid, 1);
      const note = noteInputs[item.id] || '';
      await FeedbackService.updateFeedbackStatus(
        item.id,
        'resolved',
        note ? `${note} [Access granted]` : 'Access granted'
      );
      await loadFeedback(currentPage, pageTokens);
    } catch (error) {
      console.error('Failed to grant access:', error);
      alert('Failed to grant access. Check console for details.');
    } finally {
      setProcessing(null);
    }
  };

  const formatDate = (timestamp: number | null) => {
    if (!timestamp) return 'N/A';
    return new Date(timestamp).toLocaleString();
  };

  if (!user?.isAdmin) {
    return (
      <div className="admin-feedback__denied">
        <p>Access denied. Admin privileges required.</p>
      </div>
    );
  }

  return (
    <AdminLayout title="User Feedback">
      <div className="admin-feedback">
        <div className="admin-feedback__filters">
          <div className="admin-feedback__filter">
            <label>Category</label>
            <select
              value={filterCategory}
              onChange={e => setFilterCategory(e.target.value as FeedbackCategory | '')}
            >
              <option value="">All Categories</option>
              {(Object.keys(CATEGORY_LABELS) as FeedbackCategory[]).map(cat => (
                <option key={cat} value={cat}>{CATEGORY_LABELS[cat]}</option>
              ))}
            </select>
          </div>
          <div className="admin-feedback__filter">
            <label>Status</label>
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value as FeedbackStatus | '')}
            >
              <option value="">All Statuses</option>
              {(Object.keys(STATUS_LABELS) as FeedbackStatus[]).map(status => (
                <option key={status} value={status}>{STATUS_LABELS[status]}</option>
              ))}
            </select>
          </div>
        </div>

        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          color: 'var(--white)',
          opacity: 0.7,
          fontSize: 14,
          marginBottom: 8
        }}>
          <span>
            {loading ? 'Loading...' : `Page ${currentPage + 1}`}
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage === 0 || loading}
              style={{ padding: '4px 12px', fontSize: 12, backgroundColor: 'var(--primary1-600)', border: '1px solid var(--primary1-500)', borderRadius: 4, color: 'var(--white)', cursor: 'pointer' }}
            >
              Previous
            </button>
            <button
              onClick={() => goToPage(currentPage + 1)}
              disabled={!hasMore || loading}
              style={{ padding: '4px 12px', fontSize: 12, backgroundColor: 'var(--primary1-600)', border: '1px solid var(--primary1-500)', borderRadius: 4, color: 'var(--white)', cursor: 'pointer' }}
            >
              Next
            </button>
          </div>
        </div>

        <div className="admin-feedback__scroll">
          {loading ? (
            <p className="admin-feedback__loading">Loading feedback...</p>
          ) : feedback.length === 0 ? (
            <p className="admin-feedback__empty">No feedback found.</p>
          ) : (
            <div className="admin-feedback__list">
              {feedback.map(item => {
                const isExpanded = expandedId === item.id;
                const isProcessing = processing === item.id;

                return (
                  <div key={item.id} className="admin-feedback__card">
                    <div
                      className="admin-feedback__card-header"
                      onClick={() => setExpandedId(isExpanded ? null : item.id)}
                    >
                      <div className="admin-feedback__card-meta">
                        <span className={`admin-feedback__badge admin-feedback__badge--${item.category}`}>
                          {CATEGORY_LABELS[item.category as FeedbackCategory] || item.category}
                        </span>
                        <span className={`admin-feedback__status admin-feedback__status--${item.status}`}>
                          {STATUS_LABELS[item.status as FeedbackStatus] || item.status}
                        </span>
                      </div>
                      <p className="admin-feedback__preview">
                        {item.message.length > 100 ? `${item.message.slice(0, 100)}...` : item.message}
                      </p>
                      <div className="admin-feedback__card-info">
                        <span>Route: {item.route}</span>
                        <span>{formatDate(item.createdAt)}</span>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="admin-feedback__card-detail">
                        <div className="admin-feedback__detail-section">
                          <label>User ID</label>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <code>{item.uid}</code>
                            <button
                              onClick={() => handleCopyUid(item.uid)}
                              className="admin-feedback__btn admin-feedback__btn--secondary"
                              style={{ padding: '4px 10px', fontSize: 12 }}
                            >
                              {copiedUid === item.uid ? 'Copied!' : 'Copy'}
                            </button>
                          </div>
                        </div>

                        <div className="admin-feedback__detail-section">
                          <label>Full Message</label>
                          <div className="admin-feedback__message-box">{item.message}</div>
                        </div>

                        {item.answers && (
                          <div className="admin-feedback__detail-section">
                            <label>Creator Request Answers</label>
                            <div className="admin-feedback__answers">
                              <div className="admin-feedback__answer">
                                <strong>What kind of project would you create?</strong>
                                <p>{item.answers.q1}</p>
                              </div>
                              <div className="admin-feedback__answer">
                                <strong>Do you have experience with music production?</strong>
                                <p>{item.answers.q2}</p>
                              </div>
                              <div className="admin-feedback__answer">
                                <strong>How did you hear about us?</strong>
                                <p>{item.answers.q3}</p>
                              </div>
                            </div>
                          </div>
                        )}

                        {item.adminNote && (
                          <div className="admin-feedback__detail-section">
                            <label>Admin Note</label>
                            <div className="admin-feedback__note-display">{item.adminNote}</div>
                          </div>
                        )}

                        <div className="admin-feedback__detail-section">
                          <label>Add/Update Note</label>
                          <textarea
                            className="admin-feedback__note-input"
                            placeholder="Add an admin note..."
                            value={noteInputs[item.id] || ''}
                            onChange={e => setNoteInputs(prev => ({ ...prev, [item.id]: e.target.value }))}
                            disabled={isProcessing}
                          />
                        </div>

                        <div className="admin-feedback__actions">
                          {item.status === 'new' && (
                            <button
                              className="admin-feedback__btn admin-feedback__btn--secondary"
                              onClick={() => handleUpdateStatus(item.id, 'reviewed')}
                              disabled={isProcessing}
                            >
                              {isProcessing ? 'Processing...' : 'Mark Reviewed'}
                            </button>
                          )}
                          {item.status !== 'resolved' && (
                            <button
                              className="admin-feedback__btn admin-feedback__btn--secondary"
                              onClick={() => handleUpdateStatus(item.id, 'resolved')}
                              disabled={isProcessing}
                            >
                              {isProcessing ? 'Processing...' : 'Mark Resolved'}
                            </button>
                          )}
                          {item.category === 'creator_request' && item.status !== 'resolved' && (
                            <button
                              className="admin-feedback__btn admin-feedback__btn--primary"
                              onClick={() => handleGrantAccess(item)}
                              disabled={isProcessing}
                            >
                              {isProcessing ? 'Processing...' : 'Grant Creator Access'}
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
