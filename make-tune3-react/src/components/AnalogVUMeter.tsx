import { useMemo } from 'react';

type Props = {
  value: number;
  min?: number;
  max?: number;
  size?: number;
  label?: string;
};

function fmt(sec: number) {
  const s = Math.max(0, Math.floor(sec));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${s}s`;
}

/**
 * Applies gentle companding to meter values:
 * - Slight boost on low values (quiet parts are more visible)
 * - Gentle compression on high values (prevents pegging)
 */
function compandValue(linearPct: number): number {
  const clamped = Math.max(0, Math.min(1, linearPct));
  // Gentle power curve - 0.7 gives subtle effect
  return Math.pow(clamped, 0.7);
}

export function AnalogVUMeter({ value, min = 0, max = 100, size = 120, label }: Props) {
  const clamped = Math.min(max, Math.max(min, value));
  const linearPct = (clamped - min) / (max - min || 1);
  // Apply companding: boost quiet, compress loud
  const pct = compandValue(linearPct);
  const angle = useMemo(() => {
    // keep needle within visible upper semicircle
    const start = -150; // far left, above center
    const sweep = 120;  // to -30 (right, above center)
    return start + pct * sweep;
  }, [pct]);

  const w = size;
  const h = size * 0.7;
  const cx = w / 2;
  const cy = h * 0.95;
  const r = Math.min(cx, cy) * 0.95;

  const arcPath = useMemo(() => {
    const a0 = (-150 * Math.PI) / 180; // left-upper
    const a1 = (-30 * Math.PI) / 180;  // right-upper
    const x0 = cx + r * Math.cos(a0);
    const y0 = cy + r * Math.sin(a0);
    const x1 = cx + r * Math.cos(a1);
    const y1 = cy + r * Math.sin(a1);
    return `M ${x0} ${y0} A ${r} ${r} 0 0 1 ${x1} ${y1}`;
  }, [cx, cy, r]);

  const needleX = cx + (r - 10) * Math.cos((angle * Math.PI) / 180);
  const needleY = cy + (r - 10) * Math.sin((angle * Math.PI) / 180);

  const bg = 'linear-gradient(180deg, #1e2f2f, #0f1a1a)';

  return (
    <div style={{ width: w, padding: 8, borderRadius: 12, background: bg, boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.6), 0 2px 6px rgba(0,0,0,0.4)', color: 'var(--white)' }}>
      {label && <div style={{ fontSize: 12, opacity: 0.85, textAlign: 'center' }}>{label}</div>}
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
        <path d={arcPath} stroke="#3f8d8d" strokeWidth={6} fill="none" />
        <circle cx={cx} cy={cy} r={4} fill="#e7e7e7" />
        <line x1={cx} y1={cy} x2={needleX} y2={needleY} stroke="#ffd27f" strokeWidth={3} strokeLinecap="round" />
      </svg>
      <div style={{ textAlign: 'center', fontSize: 12, opacity: 0.9 }}>{fmt(clamped)}</div>
    </div>
  );
}

