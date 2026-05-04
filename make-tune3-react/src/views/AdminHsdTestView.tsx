import { useState } from 'react';
import type { CSSProperties } from 'react';
import { AdminLayout } from '../components/AdminLayout';
import { AdminService } from '../services';
import { useAppStore } from '../stores/appStore';
import type { AdminHsdTestResult, HsdTestEntityType } from '../services/adminService';

const ENTITY_OPTIONS: { value: HsdTestEntityType; label: string }[] = [
  { value: 'project_name', label: 'Project name' },
  { value: 'project_description', label: 'Project description' },
  { value: 'collaboration_name', label: 'Collaboration name' },
  { value: 'collaboration_description', label: 'Collaboration description' }
];

const DECISION_COLORS: Record<AdminHsdTestResult['suggestedDecision'], string> = {
  allow: '#2d7a58',
  review: '#a36b10',
  reject: '#a83f3f'
};

export function AdminHsdTestView() {
  const { user } = useAppStore(state => state.auth);
  const [entityType, setEntityType] = useState<HsdTestEntityType>('project_name');
  const [entityId, setEntityId] = useState('admin-test-001');
  const [text, setText] = useState('Warm electronic collaboration for ambient producers.');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AdminHsdTestResult | null>(null);

  if (!user?.isAdmin) {
    return (
      <div style={{ padding: 24 }}>
        <p>Access denied. Admin privileges required.</p>
      </div>
    );
  }

  const handleRun = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await AdminService.runHsdTest({
        entityType,
        entityId: entityId.trim() || undefined,
        text
      });
      setResult(response);
    } catch (err: any) {
      setError(err?.message || 'Failed to run HSD test');
    } finally {
      setLoading(false);
    }
  };

  const decisionColor = result ? DECISION_COLORS[result.suggestedDecision] : '#4f5d75';

  return (
    <AdminLayout title="HSD Tester">
      <div style={{
        display: 'grid',
        gap: 16,
        gridTemplateColumns: 'minmax(0, 1fr) minmax(320px, 380px)',
        alignItems: 'start'
      }}>
        <section style={{
          background: 'rgba(255,255,255,0.08)',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 12,
          padding: 20,
          display: 'grid',
          gap: 14
        }}>
          <p style={{ margin: 0, color: 'rgba(255,255,255,0.72)' }}>
            Admin-only live HSD tester. This page calls Firebase, and Firebase calls the private HSD service.
          </p>

          <div style={{ display: 'grid', gap: 8 }}>
            <label style={{ color: 'var(--white)', fontSize: 14 }}>Entity Type</label>
            <select
              value={entityType}
              onChange={(event) => setEntityType(event.target.value as HsdTestEntityType)}
              style={inputStyle}
            >
              {ENTITY_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'grid', gap: 8 }}>
            <label style={{ color: 'var(--white)', fontSize: 14 }}>Entity ID</label>
            <input
              value={entityId}
              onChange={(event) => setEntityId(event.target.value)}
              placeholder="Optional test id"
              style={inputStyle}
            />
          </div>

          <div style={{ display: 'grid', gap: 8 }}>
            <label style={{ color: 'var(--white)', fontSize: 14 }}>Text</label>
            <textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              style={{ ...inputStyle, minHeight: 220, resize: 'vertical' }}
              placeholder="Enter text to score"
            />
          </div>

          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <button
              onClick={handleRun}
              disabled={loading || !text.trim()}
              style={{
                border: 'none',
                borderRadius: 8,
                padding: '10px 16px',
                background: 'var(--contrast-600)',
                color: 'var(--white)',
                fontWeight: 600,
                cursor: loading ? 'wait' : 'pointer',
                opacity: loading || !text.trim() ? 0.65 : 1
              }}
            >
              {loading ? 'Running…' : 'Run HSD'}
            </button>
            {error && <span style={{ color: '#ff9d9d' }}>{error}</span>}
          </div>
        </section>

        <aside style={{
          background: 'rgba(7,10,16,0.45)',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 12,
          padding: 20,
          display: 'grid',
          gap: 14,
          minHeight: 300
        }}>
          <div>
            <div style={{ color: 'rgba(255,255,255,0.64)', fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Latest Result
            </div>
            <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{
                background: decisionColor,
                color: 'white',
                padding: '6px 10px',
                borderRadius: 999,
                fontSize: 13,
                fontWeight: 700,
                textTransform: 'uppercase'
              }}>
                {result?.suggestedDecision || '—'}
              </span>
              <span style={{ color: 'var(--white)', fontSize: 18, fontWeight: 600 }}>
                {result ? `${(result.score * 100).toFixed(1)}% hateful` : 'No result yet'}
              </span>
            </div>
          </div>

          <div style={{ display: 'grid', gap: 10 }}>
            {result ? (
              <>
                <InfoRow label="Model" value={result.modelVersion} />
                <InfoRow label="Label" value={result.label} />
                <InfoRow label="Latency" value={`${result.elapsedMs} ms`} />
                <InfoRow label="Request ID" value={result.requestId} mono />
                <InfoRow label="Entity Type" value={result.entityType} mono />
                <InfoRow label="Entity ID" value={result.entityId || '—'} mono />
                <div style={{ display: 'grid', gap: 6 }}>
                  <label style={{ color: 'rgba(255,255,255,0.64)', fontSize: 12 }}>Response JSON</label>
                  <pre style={preStyle}>{JSON.stringify(result, null, 2)}</pre>
                </div>
              </>
            ) : (
              <div style={{ color: 'rgba(255,255,255,0.68)', lineHeight: 1.5 }}>
                Run a test to see the live HSD response from the deployed service.
              </div>
            )}
          </div>
        </aside>
      </div>
    </AdminLayout>
  );
}

function InfoRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ display: 'grid', gap: 4 }}>
      <label style={{ color: 'rgba(255,255,255,0.64)', fontSize: 12 }}>{label}</label>
      <div style={{
        color: 'var(--white)',
        fontFamily: mono ? 'monospace' : 'inherit',
        wordBreak: 'break-word'
      }}>
        {value}
      </div>
    </div>
  );
}

const inputStyle: CSSProperties = {
  width: '100%',
  borderRadius: 8,
  border: '1px solid rgba(255,255,255,0.18)',
  background: 'rgba(255,255,255,0.08)',
  color: 'var(--white)',
  padding: '12px 14px',
  font: 'inherit',
  boxSizing: 'border-box'
};

const preStyle: CSSProperties = {
  margin: 0,
  borderRadius: 8,
  padding: 12,
  background: 'rgba(0,0,0,0.35)',
  color: '#dbe7ff',
  fontSize: 12,
  overflowX: 'auto'
};
