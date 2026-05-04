import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { AudioEngine } from '../audio-services/audio-engine';
import './AudioVisualizerCanvas.css';

type ScopeSource = 'submission' | 'backing';

interface ChannelScopeCanvasProps {
  engine: AudioEngine | null | undefined;
  source: ScopeSource;
  className?: string;
  ariaLabel?: string;
  style?: CSSProperties;
}

export function ChannelScopeCanvas({
  engine,
  source,
  className = '',
  ariaLabel,
  style
}: ChannelScopeCanvasProps) {
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

    const subscribe = source === 'submission'
      ? engine.onPlayer1Scope.bind(engine)
      : engine.onPlayer2Scope.bind(engine);

    const unsubscribe = subscribe(frame => {
      const canvas = canvasRef.current;
      if (!canvas || canvas.width <= 0 || canvas.height <= 0 || frame.length === 0) {
        return;
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const width = canvas.width;
      const height = canvas.height;
      const midY = height / 2;
      const amplitude = Math.max(1, height * 0.44);
      const step = Math.max(1, Math.floor(frame.length / Math.max(1, width / 2)));

      ctx.fillStyle = 'rgba(5, 10, 14, 0.22)';
      ctx.fillRect(0, 0, width, height);

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.lineWidth = Math.max(1, (window.devicePixelRatio || 1) * 0.9);
      ctx.beginPath();
      ctx.moveTo(0, midY + 0.5);
      ctx.lineTo(width, midY + 0.5);
      ctx.stroke();

      ctx.strokeStyle = source === 'submission'
        ? 'rgba(112, 224, 204, 0.35)'
        : 'rgba(245, 174, 92, 0.35)';
      ctx.lineWidth = Math.max(2, window.devicePixelRatio || 1);
      ctx.beginPath();

      let hasPoint = false;
      let pointIndex = 0;
      for (let i = 0; i < frame.length; i += step) {
        const x = (pointIndex / Math.max(1, Math.ceil(frame.length / step) - 1)) * width;
        const y = midY + frame[i] * amplitude;
        if (!hasPoint) {
          ctx.moveTo(x, y);
          hasPoint = true;
        } else {
          ctx.lineTo(x, y);
        }
        pointIndex += 1;
      }
      ctx.stroke();

      ctx.strokeStyle = source === 'submission'
        ? 'rgba(112, 224, 204, 0.95)'
        : 'rgba(245, 174, 92, 0.95)';
      ctx.lineWidth = Math.max(1, window.devicePixelRatio || 1);
      ctx.stroke();
    });

    return unsubscribe;
  }, [engine, source]);

  return (
    <div
      ref={wrapRef}
      className={['audio-visualizer', 'audio-visualizer--scope', className].filter(Boolean).join(' ')}
      style={style}
    >
      <canvas
        ref={canvasRef}
        className="audio-visualizer__canvas"
        aria-label={ariaLabel ?? `${source} waveform scope`}
      />
    </div>
  );
}
