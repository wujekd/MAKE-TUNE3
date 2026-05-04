import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { AudioEngine } from '../audio-services/audio-engine';
import './AudioVisualizerCanvas.css';

interface MasterSpectrogramCanvasProps {
  engine: AudioEngine | null | undefined;
  className?: string;
  style?: CSSProperties;
}

function getSpectrogramColor(level: number): string {
  const clamped = Math.max(0, Math.min(1, level));
  if (clamped < 0.08) return 'rgba(6, 14, 18, 0.95)';
  if (clamped < 0.24) return `rgba(18, 72, 78, ${0.5 + clamped})`;
  if (clamped < 0.48) return `rgba(56, 170, 161, ${0.6 + clamped * 0.5})`;
  if (clamped < 0.75) return `rgba(234, 166, 78, ${0.72 + clamped * 0.28})`;
  return `rgba(245, 101, 42, ${0.8 + clamped * 0.2})`;
}

export function MasterSpectrogramCanvas({
  engine,
  className = '',
  style
}: MasterSpectrogramCanvasProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const node = wrapRef.current;
    if (!node || typeof ResizeObserver === 'undefined') {
      setSize({
        width: node?.clientWidth ?? 0,
        height: node?.clientHeight ?? 0
      });
      return;
    }

    const observer = new ResizeObserver(entries => {
      const entry = entries[0];
      if (!entry) return;
      setSize({
        width: Math.round(entry.contentRect.width),
        height: Math.round(entry.contentRect.height)
      });
    });

    observer.observe(node);
    setSize({
      width: node.clientWidth,
      height: node.clientHeight
    });

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || size.width <= 0 || size.height <= 0) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.round(size.width * dpr));
    canvas.height = Math.max(1, Math.round(size.height * dpr));
  }, [size.height, size.width]);

  useEffect(() => {
    if (!engine) return;

    const unsubscribe = engine.onMasterSpectrum(frame => {
      const canvas = canvasRef.current;
      if (!canvas || canvas.width <= 0 || canvas.height <= 0 || frame.length === 0) {
        return;
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const width = canvas.width;
      const height = canvas.height;
      const columnWidth = Math.max(1, Math.round((window.devicePixelRatio || 1) * 1.2));
      const maxIndex = Math.max(1, frame.length - 1);

      ctx.drawImage(canvas, -columnWidth, 0);
      ctx.fillStyle = 'rgba(5, 8, 12, 0.92)';
      ctx.fillRect(width - columnWidth, 0, columnWidth, height);

      for (let y = 0; y < height; y += 1) {
        const ratio = 1 - y / Math.max(1, height - 1);
        const curved = (Math.exp(ratio * Math.log(maxIndex + 1)) - 1) / maxIndex;
        const bin = Math.min(maxIndex, Math.max(0, Math.round(curved * maxIndex)));
        const intensity = Math.pow(frame[bin] / 255, 1.15);
        ctx.fillStyle = getSpectrogramColor(intensity);
        ctx.fillRect(width - columnWidth, y, columnWidth, 1);
      }
    });

    return unsubscribe;
  }, [engine]);

  return (
    <div
      ref={wrapRef}
      className={['audio-visualizer', 'audio-visualizer--spectrogram', className].filter(Boolean).join(' ')}
      style={style}
    >
      <canvas
        ref={canvasRef}
        className="audio-visualizer__canvas"
        aria-label="Master spectrogram"
      />
    </div>
  );
}
