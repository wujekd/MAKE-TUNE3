import { useEffect, useState } from 'react';
import { AdminService } from '../services';
import { useAppStore } from '../stores/appStore';
import { AdminLayout } from '../components/AdminLayout';

interface ReportDisplay {
  id: string;
  submissionPath: string;
  collaborationId: string;
  reportedBy: string;
  reportedByUsername: string;
  reason: string;
  status: string;
  createdAt: number | null;
  resolvedAt: number | null;
  resolvedBy: string | null;
  reportedUserId: string | null;
}

export function AdminResolvedReportsView() {
  const { user } = useAppStore(state => state.auth);
  const [reports, setReports] = useState<ReportDisplay[]>([]);
  const [loading, setLoading] = useState(true);

  const [pageTokens, setPageTokens] = useState<(string | null)[]>([null]);
  const [currentPage, setCurrentPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    loadReports(0, [null]);
  }, []);

  const loadReports = async (page: number, tokens: (string | null)[]) => {
    setLoading(true);
    try {
      const result = await AdminService.listResolvedReports(25, tokens[page] ?? null);
      setReports(result.reports.map(r => ({
        id: r.id,
        submissionPath: r.submissionPath,
        collaborationId: r.collaborationId,
        reportedBy: r.reportedBy,
        reportedByUsername: r.reportedByUsername,
        reason: r.reason,
        status: r.status,
        createdAt: r.createdAt,
        resolvedAt: r.resolvedAt,
        resolvedBy: r.resolvedBy,
        reportedUserId: r.reportedUserId
      })));
      setHasMore(result.hasMore);

      const newTokens = [...tokens];
      if (result.nextPageToken) {
        newTokens[page + 1] = result.nextPageToken;
      }
      setPageTokens(newTokens);
      setCurrentPage(page);
    } catch {
      alert('Failed to load resolved reports');
    } finally {
      setLoading(false);
    }
  };

  const goToPage = (page: number) => {
    if (page < 0) return;
    loadReports(page, pageTokens);
  };

  const formatDate = (value: number | null): string => {
    if (!value) return 'N/A';
    return new Date(value).toLocaleString();
  };

  if (!user?.isAdmin) {
    return (
      <div style={{ padding: '2rem', color: 'var(--white)' }}>
        <p>Access denied. Admin privileges required.</p>
      </div>
    );
  }

  return (
    <AdminLayout title="Resolved Reports History">
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
            style={{ padding: '4px 12px', fontSize: 12 }}
          >
            Previous
          </button>
          <button
            onClick={() => goToPage(currentPage + 1)}
            disabled={!hasMore || loading}
            style={{ padding: '4px 12px', fontSize: 12 }}
          >
            Next
          </button>
        </div>
      </div>

      {loading ? (
        <p style={{ color: 'var(--white)' }}>Loading reports...</p>
      ) : reports.length === 0 ? (
        <p style={{ opacity: 0.7, color: 'var(--white)' }}>No resolved reports.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {reports.map((report) => (
            <div
              key={report.id}
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '8px',
                padding: '1.5rem',
                color: 'var(--white)'
              }}
            >
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                marginBottom: '1rem'
              }}>
                <div
                  style={{
                    padding: '0.25rem 0.75rem',
                    borderRadius: '12px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    backgroundColor: report.status === 'user-banned'
                      ? 'rgba(200, 50, 50, 0.3)'
                      : 'rgba(100, 100, 100, 0.3)',
                    border: report.status === 'user-banned'
                      ? '1px solid rgba(200, 50, 50, 0.5)'
                      : '1px solid rgba(150, 150, 150, 0.5)'
                  }}
                >
                  {report.status === 'user-banned' ? 'User Banned' : 'Dismissed'}
                </div>
                {report.reportedUserId && (
                  <div
                    style={{
                      padding: '0.25rem 0.75rem',
                      borderRadius: '12px',
                      fontSize: '0.75rem',
                      backgroundColor: 'rgba(255, 140, 0, 0.2)',
                      border: '1px solid rgba(255, 140, 0, 0.4)'
                    }}
                  >
                    User ID: {report.reportedUserId.substring(0, 8)}...
                  </div>
                )}
              </div>

              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '1rem',
                marginBottom: '1rem'
              }}>
                <div>
                  <div style={{ fontSize: '0.875rem', opacity: 0.7, marginBottom: '0.25rem' }}>
                    Submission Path
                  </div>
                  <div style={{
                    fontSize: '0.75rem',
                    fontFamily: 'monospace',
                    wordBreak: 'break-all'
                  }}>
                    {report.submissionPath}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '0.875rem', opacity: 0.7, marginBottom: '0.25rem' }}>
                    Reported By
                  </div>
                  <div>
                    {report.reportedByUsername || 'Unknown'}
                  </div>
                </div>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <div style={{ fontSize: '0.875rem', opacity: 0.7, marginBottom: '0.25rem' }}>
                  Reason
                </div>
                <div style={{
                  padding: '0.75rem',
                  backgroundColor: 'rgba(0, 0, 0, 0.2)',
                  borderRadius: '4px'
                }}>
                  {report.reason}
                </div>
              </div>

              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr',
                gap: '1rem',
                fontSize: '0.875rem',
                opacity: 0.7
              }}>
                <div>
                  <strong>Collaboration ID:</strong> {report.collaborationId}
                </div>
                <div>
                  <strong>Reported At:</strong> {formatDate(report.createdAt)}
                </div>
                <div>
                  <strong>Resolved At:</strong> {formatDate(report.resolvedAt)}
                </div>
                <div>
                  <strong>Resolved By:</strong> {report.resolvedBy || 'N/A'}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </AdminLayout>
  );
}
