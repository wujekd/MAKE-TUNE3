import { useEffect, useRef, useState } from 'react';

interface CountUpValueProps {
  value: number;
  className?: string;
  durationMs?: number;
  formatValue?: (value: number) => string;
}

const easeInOutCubic = (t: number): number =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

const normalizeValue = (value: number): number => {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value);
};

export function CountUpValue({
  value,
  className,
  durationMs = 850,
  formatValue
}: CountUpValueProps) {
  const [displayValue, setDisplayValue] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const target = normalizeValue(value);
    const reducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    if (reducedMotion || durationMs <= 0 || target === 0) {
      setDisplayValue(target);
      return;
    }

    const start = performance.now();
    setDisplayValue(0);

    const step = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(1, elapsed / durationMs);
      const eased = easeInOutCubic(progress);
      const next = Math.round(target * eased);
      setDisplayValue(next);

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        rafRef.current = null;
      }
    };

    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [value, durationMs]);

  const formatted = formatValue ? formatValue(displayValue) : String(displayValue);
  return <span className={className}>{formatted}</span>;
}
