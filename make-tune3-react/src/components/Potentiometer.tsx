import { useMemo, useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { CSSProperties } from 'react';

type Props = {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  size?: number;
  label?: string;
  disabled?: boolean;
  onChange: (v: number) => void;
  onInput?: (v: number) => void;
  showValue?: boolean;
  color?: string;
  middleText?: string;
  startText?: string;
  endText?: string;
};

export function Potentiometer({ value, min = 0, max = 100, step = 1, size = 56, label, disabled = false, onChange, onInput, showValue = true, color, middleText, startText, endText }: Props) {
  const clamped = Math.min(max, Math.max(min, value));

  const [dragValue, setDragValue] = useState<number | null>(null);
  const [hovered, setHovered] = useState(false);
  const [popupPos, setPopupPos] = useState<{ x: number; y: number } | null>(null);
  const dragging = dragValue !== null;
  const displayValue = dragging ? (dragValue as number) : clamped;
  const pct = (displayValue - min) / (max - min || 1);

  const startYRef = useRef<number>(0);
  const startValRef = useRef<number>(0);

  // pixels for full range sweep
  const sensitivity = 165;
  const angle = useMemo(() => {
    const start = -135; // start angle
    const sweep = 270;  // total sweep
    return start + pct * sweep;
  }, [pct]);

  const knobRef = useRef<HTMLDivElement | null>(null);

  const knobStyle: CSSProperties = {
    width: size,
    height: size,
    borderRadius: '50%',
    background: color
      ? `radial-gradient(circle at 30% 30%, ${color}, #1b3031)`
      : 'radial-gradient(circle at 30% 30%, #3a6d6e, #1b3031)',
    border: '2px solid #0f1a1a',
    boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.5), 0 1px 2px rgba(0,0,0,0.4)',
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    opacity: disabled ? 0.6 : 1,
    cursor: disabled ? 'not-allowed' : 'ns-resize',
    userSelect: 'none'
  };

  const markerStyle: CSSProperties = {
    position: 'absolute',
    width: 2,
    height: size * 0.35,
    background: color ? '#ffd27f' : '#e7e7e7',
    top: size * 0.15,
    transformOrigin: 'center calc(100% - 2px)',
    transform: `rotate(${angle}deg)`,
    borderRadius: 2,
    boxShadow: '0 0 2px rgba(255,255,255,0.6)'
  };

  const tickContainerStyle: CSSProperties = {
    position: 'absolute',
    inset: 0,
    pointerEvents: 'none'
  };

  const handleRange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = Number(e.target.value);
    if (!Number.isNaN(next)) {
      onInput && onInput(next);
      onChange(next);
    }
  };

  const handleNumber = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const next = Number(raw);
    if (!Number.isNaN(next)) {
      const v = Math.min(max, Math.max(min, next));
      onInput && onInput(v);
      onChange(v);
    }
  };

  // drag handlers
  useEffect(() => {
    if (!dragging) return;
    const handleMove = (e: MouseEvent) => {
      const dy = e.clientY - startYRef.current; // down is +dy, up is -dy
      const effSensitivity = e.shiftKey ? sensitivity * 5 : sensitivity;
      const delta = (-dy / effSensitivity) * (max - min);
      let next = startValRef.current + delta;
      // snap to step
      next = Math.round(next / step) * step;
      // clamp
      next = Math.min(max, Math.max(min, next));
      setDragValue(next);
      onInput && onInput(next);
    };
    const handleUp = () => {
      if (dragValue !== null) onChange(Math.min(max, Math.max(min, Math.round(dragValue / step) * step)));
      setDragValue(null);
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
      // restore selection
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
    return () => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
    };
  }, [dragging, dragValue, min, max, step, sensitivity, onChange]);

  const startDrag = (e: React.MouseEvent) => {
    if (disabled) return;
    startYRef.current = e.clientY;
    startValRef.current = clamped;
    setDragValue(clamped);
    // prevent text selection during drag
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'ns-resize';
  };

  useEffect(() => {
    if (!(dragging || hovered)) {
      setPopupPos(null);
      return;
    }
    const el = knobRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setPopupPos({ x: rect.right + 8, y: rect.top + rect.height / 2 });
  }, [dragging, hovered, size]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {label && <div style={{ fontSize: 13, opacity: 0.9, color: 'var(--white)' }}>{label}</div>}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: size }}>
          <div
          style={knobStyle}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={displayValue}
          role="slider"
          aria-label={label}
          onMouseDown={startDrag}
          ref={knobRef}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          onFocus={() => setHovered(true)}
          onBlur={() => setHovered(false)}
          >
          <div style={tickContainerStyle} />
          <div style={markerStyle} />
          </div>
          {(startText || middleText || endText) && (
            <div style={{ position: 'relative', width: '100%', height: 12, marginTop: 2, color: 'var(--white)', opacity: 0.8 }}>
              {startText && (
                <span style={{ position: 'absolute', left: -3, top: -9, transform: 'translateX(-6px)', fontSize: 9 }}>
                  {startText}
                </span>
              )}
              {middleText && (
                <span style={{ position: 'absolute', left: '60%', top: -1, transform: 'translateX(-10px)', fontSize: 10 }}>
                  {middleText}
                </span>
              )}
              {endText && (
                <span style={{ position: 'absolute', right: -3, top: -9, transform: 'translateX(6px)', fontSize: 9 }}>
                  {endText}
                </span>
              )}
            </div>
          )}
        </div>
        {!showValue && dragging && popupPos && createPortal(
          <div
            style={{
              position: 'fixed',
              left: popupPos.x,
              top: popupPos.y,
              transform: 'translateY(-50%)',
              background: 'rgba(15, 26, 26, 0.95)',
              color: 'var(--white)',
              border: '1px solid #0b1414',
              boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
              borderRadius: 6,
              padding: '2px 6px',
              fontSize: 12,
              whiteSpace: 'pre',
              fontFamily: 'monospace',
              pointerEvents: 'none',
              zIndex: 9999
            }}
          >
            {(() => {
              const val = Math.round(displayValue);
              const fixed = String(val).padStart(5, ' ');
              return label ? `${label}: ${fixed}` : `${fixed}`;
            })()}
          </div>,
          document.body
        )}
        {showValue && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
            <input
              type="range"
              min={min}
              max={max}
              step={step}
              value={displayValue}
              onChange={handleRange}
              disabled={disabled}
              aria-hidden
              style={{ display: 'none' }}
            />
            <input
              type="number"
              min={min}
              max={max}
              step={step}
              value={displayValue}
              onChange={handleNumber}
              disabled={disabled}
              style={{ padding: 6, borderRadius: 6, border: '1px solid var(--primary1-800)', background: 'var(--primary1-800)', color: 'var(--white)' }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// update popup position when visible
// eslint-disable-next-line react-hooks/rules-of-hooks
useEffect.bind(null);

