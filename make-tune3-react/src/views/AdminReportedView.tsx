import { useEffect, useState } from 'react';
import { AdminService, ReportService } from '../services';
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
}

export function AdminReportedView() {
  const { user } = useAppStore(state => state.auth);
  const [reports, setReports] = useState<ReportDisplay[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);

  const [pageTokens, setPageTokens] = useState<(string | null)[]>([null]);
  const [currentPage, setCurrentPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    loadReports(0, [null]);
  }, []);

  const loadReports = async (page: number, tokens: (string | null)[]) => {
    setLoading(true);
    try {
      const result = await AdminService.listPendingReports(25, tokens[page] ?? null);
      setReports(result.reports.map(r => ({
        id: r.id,
        submissionPath: r.submissionPath,
        collaborationId: r.collaborationId,
        reportedBy: r.reportedBy,
        reportedByUsername: r.reportedByUsername,
        reason: r.reason,
        status: r.status,
        createdAt: r.createdAt
      })));
      setHasMore(result.hasMore);

      const newTokens = [...tokens];
      if (result.nextPageToken) {
        newTokens[page + 1] = result.nextPageToken;
      }
      setPageTokens(newTokens);
      setCurrentPage(page);
    } catch {
      alert('Failed to load reports');
    } finally {
      setLoading(false);
    }
  };

  const goToPage = (page: number) => {
    if (page < 0) return;
    loadReports(page, pageTokens);
  };

  const handleDismiss = async (reportId: string) => {
    if (!user) return;

    const confirmed = window.confirm('Dismiss this report? The submission will remain visible.');
    if (!confirmed) return;

    setProcessing(reportId);
    try {
      await ReportService.dismissReport(reportId, user.uid);
      await loadReports(currentPage, pageTokens);
    } catch {
      alert('Failed to dismiss report');
    } finally {
      setProcessing(null);
    }
  };

  const handleBanUser = async (report: ReportDisplay) => {
    if (!user) {
      alert('You must be logged in to ban users');
      return;
    }

    const confirmed = window.confirm(
      `Ban the user who submitted this? This action will mark them as banned in the system.`
    );
    if (!confirmed) return;

    setProcessing(report.id);
    try {
      await ReportService.banUserAndResolveReport(
        report.id,
        report.submissionPath,
        report.collaborationId
      );
      await loadReports(currentPage, pageTokens);
      alert('User has been banned and report resolved.');
    } catch (error) {
      alert('Failed to ban user. Please check console for details.');
      console.error('Ban error:', error);
    } finally {
      setProcessing(null);
    }
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
    <AdminLayout title="Reported Submissions">
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
        <p style={{ opacity: 0.7, color: 'var(--white)' }}>No pending reports.</p>
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
                gridTemplateColumns: '1fr 1fr',
                gap: '1rem',
                marginBottom: '1rem',
                fontSize: '0.875rem',
                opacity: 0.7
              }}>
                <div>
                  <strong>Collaboration ID:</strong> {report.collaborationId}
                </div>
                <div>
                  <strong>Reported At:</strong> {formatDate(report.createdAt)}
                </div>
              </div>

              <div style={{
                display: 'flex',
                gap: '1rem',
                paddingTop: '1rem',
                borderTop: '1px solid rgba(255, 255, 255, 0.1)'
              }}>
                <button
                  onClick={() => handleDismiss(report.id)}
                  disabled={processing === report.id}
                  style={{
                    flex: 1,
                    padding: '0.75rem',
                    backgroundColor: 'rgba(100, 100, 100, 0.3)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    borderRadius: '4px',
                    color: 'var(--white)',
                    cursor: processing === report.id ? 'default' : 'pointer',
                    opacity: processing === report.id ? 0.5 : 1
                  }}
                >
                  {processing === report.id ? 'Processing...' : 'Dismiss Report'}
                </button>

                <button
                  onClick={() => handleBanUser(report)}
                  disabled={processing === report.id}
                  style={{
                    flex: 1,
                    padding: '0.75rem',
                    backgroundColor: 'rgba(200, 50, 50, 0.3)',
                    border: '1px solid rgba(200, 50, 50, 0.5)',
                    borderRadius: '4px',
                    color: 'var(--white)',
                    cursor: processing === report.id ? 'default' : 'pointer',
                    opacity: processing === report.id ? 0.5 : 1
                  }}
                >
                  {processing === report.id ? 'Processing...' : 'Ban User'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </AdminLayout>
  );
}
