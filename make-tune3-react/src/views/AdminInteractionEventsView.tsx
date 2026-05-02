import { useCallback, useEffect, useState } from 'react';
import { AdminLayout } from '../components/AdminLayout';
import { useAppStore } from '../stores/appStore';
import { AdminService } from '../services';
import type { InteractionEvent } from '../types/collaboration';
import type { InteractionEventsPage } from '../services/adminService';
import './AdminInteractionEventsView.css';

const PAGE_SIZE = 25;

const formatDateTime = (timestamp: InteractionEvent['createdAt']) => {
  if (!timestamp) return 'Pending timestamp';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp as any);
  return date.toLocaleString();
};

const displayValue = (value: string | null | undefined) => value || '—';

export function AdminInteractionEventsView() {
  const { user } = useAppStore(state => state.auth);
  const [page, setPage] = useState<InteractionEventsPage | null>(null);
  const [cursorStack, setCursorStack] = useState<(InteractionEventsPage['nextCursor'] | null)[]>([null]);
  const [pageIndex, setPageIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadPage = useCallback(async (cursor: InteractionEventsPage['nextCursor'] | null, index: number) => {
    setLoading(true);
    setError(null);
    try {
      const nextPage = await AdminService.listInteractionEvents({ pageSize: PAGE_SIZE, cursor });
      setPage(nextPage);
      setPageIndex(index);
    } catch (err: any) {
      setError(err?.message || 'Failed to load interaction events');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user?.isAdmin) {
      setLoading(false);
      return;
    }
    void loadPage(cursorStack[0], 0);
  }, [loadPage, user?.isAdmin]);

  const handleRefresh = async () => {
    await loadPage(cursorStack[pageIndex] ?? null, pageIndex);
  };

  const handleNext = async () => {
    if (!page?.hasMore || !page.nextCursor) return;
    const nextIndex = pageIndex + 1;
    setCursorStack(current => {
      const next = [...current];
      next[nextIndex] = page.nextCursor;
      return next;
    });
    await loadPage(page.nextCursor, nextIndex);
  };

  const handlePrevious = async () => {
    if (pageIndex === 0) return;
    const previousIndex = pageIndex - 1;
    await loadPage(cursorStack[previousIndex] ?? null, previousIndex);
  };

  if (!user?.isAdmin) {
    return (
      <div className="admin-events__state">
        <p>Access denied. Admin privileges required.</p>
      </div>
    );
  }

  return (
    <AdminLayout title="Interaction Events">
      <div className="admin-events">
        <div className="admin-events__toolbar">
          <div>
            Monitoring the latest recommendation and analytics interaction events.
            {page && ` Page ${pageIndex + 1} • ${page.events.length} item${page.events.length === 1 ? '' : 's'}`}
          </div>
          <div className="admin-events__toolbar-actions">
            <button className="admin-events__button" onClick={handleRefresh} disabled={loading}>
              Refresh
            </button>
            <button className="admin-events__button" onClick={handlePrevious} disabled={loading || pageIndex === 0}>
              Previous
            </button>
            <button className="admin-events__button" onClick={handleNext} disabled={loading || !page?.hasMore}>
              Next
            </button>
          </div>
        </div>

        {loading ? (
          <div className="admin-events__state">Loading interaction events...</div>
        ) : error ? (
          <div className="admin-events__state admin-events__error">{error}</div>
        ) : !page || page.events.length === 0 ? (
          <div className="admin-events__state">No interaction events found.</div>
        ) : (
          <div className="admin-events__list">
            {page.events.map(event => (
              <article key={event.id} className="admin-events__card">
                <div className="admin-events__top">
                  <div className="admin-events__meta">
                    <span className="admin-events__pill admin-events__pill--type">{event.eventType}</span>
                    <span className="admin-events__pill admin-events__pill--entity">{event.entityType}</span>
                  </div>
                  <div className="admin-events__time">{formatDateTime(event.createdAt)}</div>
                </div>

                <div className="admin-events__grid">
                  <div className="admin-events__field">
                    <label>Event ID</label>
                    <code>{event.id}</code>
                  </div>
                  <div className="admin-events__field">
                    <label>User ID</label>
                    <code>{event.userId}</code>
                  </div>
                  <div className="admin-events__field">
                    <label>Project ID</label>
                    <code>{displayValue(event.projectId)}</code>
                  </div>
                  <div className="admin-events__field">
                    <label>Collaboration ID</label>
                    <code>{event.collaborationId}</code>
                  </div>
                  <div className="admin-events__field">
                    <label>Track Path</label>
                    <code>{displayValue(event.trackPath)}</code>
                  </div>
                  <div className="admin-events__field">
                    <label>Previous Track</label>
                    <code>{displayValue(event.metadata?.previousTrackPath)}</code>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
