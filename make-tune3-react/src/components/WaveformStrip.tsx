import { useEffect, useMemo, useRef, useState } from 'react';
import type { MouseEvent } from 'react';
import type { WaveformRenderData } from '../types/waveform';
import './WaveformStrip.css';

type WaveformStripState = 'loading' | 'ready' | 'placeholder';

interface WaveformStripProps {
  data: WaveformRenderData | null;
  state: WaveformStripState;
  initialUnderlayData?: WaveformRenderData | null;
  animationDelayMs?: number;
  initialCascadeProgress?: number;
  repeatCascadeProgress?: number;
  progress?: number;
  currentTime?: number;
  duration?: number;
  isPlaying?: boolean;
  isInteractive?: boolean;
  underlayAlpha?: number;
  waveformAlpha?: number;
  onSeek?: (ratio: number) => void;
}

function clamp(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function getWaveformSignature(data: WaveformRenderData): string {
  return [
    data.version ?? 'preview',
    data.bucketCount,
    data.peaks.min.length,
    data.peaks.max.length
  ].join(':');
}

function easeOutCubic(value: number): number {
  const nextValue = clamp(value);
  return 1 - Math.pow(1 - nextValue, 3);
}

export function WaveformStrip({
  data,
  state,
  initialUnderlayData = null,
  animationDelayMs = 0,
  initialCascadeProgress = 0,
  repeatCascadeProgress = 0.5,
  progress = 0,
  currentTime = 0,
  duration = 0,
  isPlaying = false,
  isInteractive = false,
  underlayAlpha = 1,
  waveformAlpha = 1,
  onSeek
}: WaveformStripProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const [canvasWidth, setCanvasWidth] = useState(0);
  const [canvasHeight, setCanvasHeight] = useState(0);
  const [hoverRatio, setHoverRatio] = useState<number | null>(null);
  const lastHoverRatioRef = useRef<number | null>(null);
  const hoverIntensityRef = useRef(0);
  const hoverTargetIntensityRef = useRef(0);
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
  const progressRef = useRef(clamp(progress));
  const currentTimeRef = useRef(Math.max(0, currentTime));
  const durationRef = useRef(Math.max(0, duration));
  const isPlayingRef = useRef(Boolean(isPlaying));
  const propTimestampRef = useRef(typeof performance !== 'undefined' ? performance.now() : 0);
  const renderedDataRef = useRef<WaveformRenderData | null>(null);
  const underlayDataRef = useRef<WaveformRenderData | null>(null);
  const renderedSignatureRef = useRef<string | null>(null);
  const cascadeStartedAtRef = useRef(0);

  const baseProgress = useMemo(() => clamp(progress), [progress]);

  useEffect(() => {
    progressRef.current = baseProgress;
    currentTimeRef.current = Math.max(0, currentTime);
    durationRef.current = Math.max(0, duration);
    isPlayingRef.current = Boolean(isPlaying);
    propTimestampRef.current = typeof performance !== 'undefined' ? performance.now() : 0;
  }, [baseProgress, currentTime, duration, isPlaying]);

  useEffect(() => {
    const node = wrapRef.current;
    if (!node || typeof ResizeObserver === 'undefined') {
      setCanvasWidth(node?.clientWidth || 0);
      return;
    }

    const observer = new ResizeObserver(entries => {
      const entry = entries[0];
      if (!entry) return;
      setCanvasWidth(Math.round(entry.contentRect.width));
      setCanvasHeight(Math.round(entry.contentRect.height));
    });

    observer.observe(node);
    setCanvasWidth(node.clientWidth);
    setCanvasHeight(node.clientHeight);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (state !== 'ready' || !data) {
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas || canvasWidth <= 0 || canvasHeight <= 0) {
      return;
    }

    const cssHeight = canvasHeight;
    canvas.width = Math.max(1, Math.round(canvasWidth * dpr));
    canvas.height = Math.max(1, Math.round(cssHeight * dpr));
    canvas.style.height = `${cssHeight}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const nextSignature = getWaveformSignature(data);
    if (renderedSignatureRef.current !== nextSignature) {
      const wasAlreadyRendered = renderedSignatureRef.current !== null;
      const initialUnderlaySignature = initialUnderlayData ? getWaveformSignature(initialUnderlayData) : null;
      const shouldUseInitialUnderlay = !wasAlreadyRendered
        && initialUnderlayData
        && initialUnderlaySignature !== nextSignature;
      underlayDataRef.current = shouldUseInitialUnderlay ? initialUnderlayData : renderedDataRef.current;
      renderedDataRef.current = data;
      renderedSignatureRef.current = nextSignature;
      const now = typeof performance !== 'undefined' ? performance.now() : 0;
      const cascadeStartProgress = shouldUseInitialUnderlay
        ? repeatCascadeProgress
        : wasAlreadyRendered
          ? repeatCascadeProgress
          : initialCascadeProgress;
      const cascadeOffsetMs = clamp(cascadeStartProgress) * 950;
      const cascadeDelayMs = cascadeStartProgress >= 1 ? 0 : Math.max(0, animationDelayMs);
      cascadeStartedAtRef.current = now + cascadeDelayMs - cascadeOffsetMs;
    } else {
      renderedDataRef.current = data;
    }

    const drawWaveformLayer = (
      waveformData: WaveformRenderData,
      progressRatio: number,
      cascadeProgress: number,
      options: { alpha: number; minHeight?: boolean }
    ) => {
      const width = canvas.width;
      const height = canvas.height;
      const baseline = height - Math.round(10 * dpr);
      const topPadding = Math.round(8 * dpr);
      const drawableHeight = Math.max(1, baseline - topPadding);
      const playedWidth = width * clamp(progressRatio);
      const playedColor = 'rgba(116, 214, 193, 0.98)';
      const unplayedColor = 'rgba(255, 255, 255, 0.26)';
      const hoveredAlpha = 0.38;
      const minPeaks = waveformData.peaks.min;
      const maxPeaks = waveformData.peaks.max;
      const barWidth = width / Math.max(1, minPeaks.length);
      const hoveredIndex = (() => {
        if (options.alpha < 1) return -1;
        const ratio = hoverRatio ?? (hoverIntensityRef.current > 0 ? lastHoverRatioRef.current : null);
        if (ratio === null) return -1;
        return Math.max(0, Math.min(minPeaks.length - 1, Math.floor(ratio * minPeaks.length)));
      })();
      const layerAlpha = Math.max(0, Math.min(1.4, options.alpha));
      const baseAlpha = layerAlpha * 0.16;
      const previousAlpha = ctx.globalAlpha;

      for (let i = 0; i < minPeaks.length; i += 1) {
        const barRevealStart = i / Math.max(1, minPeaks.length);
        const barReveal = easeOutCubic((cascadeProgress - barRevealStart * 0.72) / 0.28);
        if (barReveal <= 0) continue;

        const x = i * barWidth;
        const isHovered = i === hoveredIndex;
        const amplitude = Math.max(Math.abs(minPeaks[i]), Math.abs(maxPeaks[i]));
        const naturalHeight = amplitude * drawableHeight * 0.98;
        const barHeightBase = options.minHeight
          ? Math.max(dpr, naturalHeight * barReveal)
          : naturalHeight * barReveal;
        const intensity = isHovered ? hoverIntensityRef.current : 0;
        const enhancedHeight = Math.min(drawableHeight, barHeightBase * 1.3 + Math.round(2 * dpr));
        const barHeight = intensity > 0
          ? barHeightBase + (enhancedHeight - barHeightBase) * intensity
          : barHeightBase;
        if (barHeight <= 0) continue;

        const top = baseline - barHeight;
        const drawWidth = Math.max(dpr, barWidth - dpr);

        ctx.globalAlpha = baseAlpha;
        ctx.fillStyle = x < playedWidth ? playedColor : unplayedColor;
        ctx.fillRect(x, top, drawWidth, barHeight);

        if (isHovered && intensity > 0) {
          const glowWidth = drawWidth * 5;
          const glowHeight = barHeight * 2;
          const glowTop = baseline - glowHeight;
          const glowX = x - (glowWidth - drawWidth) / 2;
          ctx.fillStyle = `rgba(239, 123, 58, ${0.14 * intensity})`;
          ctx.fillRect(glowX, glowTop, glowWidth, glowHeight);

          const innerGlowWidth = drawWidth * 2;
          const innerGlowHeight = barHeight * 1.6;
          const innerGlowTop = baseline - innerGlowHeight;
          const innerGlowX = x - (innerGlowWidth - drawWidth) / 2;
          ctx.fillStyle = `rgba(255, 155, 60, ${0.28 * intensity})`;
          ctx.fillRect(innerGlowX, innerGlowTop, innerGlowWidth, innerGlowHeight);

          ctx.globalAlpha = 1;
          ctx.fillStyle = `rgba(239, 123, 58, ${hoveredAlpha * intensity})`;
          ctx.fillRect(x, top, drawWidth, barHeight);
        }
      }

      ctx.globalAlpha = previousAlpha;
    };

    const draw = (progressRatio: number, now: number) => {
      const width = canvas.width;
      const height = canvas.height;
      const baseline = height - Math.round(10 * dpr);
      const cascadeElapsed = Math.max(0, now - cascadeStartedAtRef.current);
      const cascadeProgress = clamp(cascadeElapsed / 950);

      ctx.clearRect(0, 0, width, height);

      const prevDrawAlpha = ctx.globalAlpha;
      ctx.globalAlpha = 0.16;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = Math.max(1, dpr);
      ctx.beginPath();
      ctx.moveTo(0, baseline + 0.5);
      ctx.lineTo(width, baseline + 0.5);
      ctx.stroke();
      ctx.globalAlpha = prevDrawAlpha;

      if (underlayDataRef.current) {
        drawWaveformLayer(underlayDataRef.current, progressRatio, 1, {
          alpha: underlayAlpha,
          minHeight: true
        });
      }

      if (renderedDataRef.current) {
        drawWaveformLayer(renderedDataRef.current, progressRatio, cascadeProgress, {
          alpha: waveformAlpha,
          minHeight: true
        });
      }

      return cascadeProgress;
    };

    const drawFrame = () => {
      const now = typeof performance !== 'undefined' ? performance.now() : 0;

      const hoverTarget = hoverTargetIntensityRef.current;
      const hoverCurrent = hoverIntensityRef.current;
      const intensityDiff = hoverTarget - hoverCurrent;
      if (Math.abs(intensityDiff) > 0.0005) {
        hoverIntensityRef.current = hoverCurrent + intensityDiff * 0.22;
      } else {
        hoverIntensityRef.current = hoverTarget;
      }

      const elapsedSeconds = Math.max(0, (now - propTimestampRef.current) / 1000);
      let nextProgress = progressRef.current;

      if (isPlayingRef.current && durationRef.current > 0) {
        nextProgress = clamp((currentTimeRef.current + elapsedSeconds) / durationRef.current);
      }

      const cascadeProgress = draw(nextProgress, now);

      const hoverStillAnimating = Math.abs(hoverTargetIntensityRef.current - hoverIntensityRef.current) > 0.0005;

      if (isPlayingRef.current || cascadeProgress < 1 || hoverStillAnimating) {
        animationFrameRef.current = window.requestAnimationFrame(drawFrame);
      } else {
        animationFrameRef.current = null;
      }
    };

    const now = typeof performance !== 'undefined' ? performance.now() : 0;
    const cascadeProgress = draw(baseProgress, now);

    if (isPlaying || cascadeProgress < 1 || Math.abs(hoverTargetIntensityRef.current - hoverIntensityRef.current) > 0.0005) {
      animationFrameRef.current = window.requestAnimationFrame(drawFrame);
    }

    return () => {
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [
    animationDelayMs,
    baseProgress,
    canvasHeight,
    canvasWidth,
    data,
    dpr,
    hoverRatio,
    initialCascadeProgress,
    initialUnderlayData,
    isPlaying,
    repeatCascadeProgress,
    state,
    underlayAlpha,
    waveformAlpha
  ]);

  const updateHoverRatio = (event: MouseEvent<HTMLCanvasElement>) => {
    if (!isInteractive) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = clamp((event.clientX - rect.left) / rect.width);
    setHoverRatio(ratio);
    lastHoverRatioRef.current = ratio;
    hoverTargetIntensityRef.current = 1;
    hoverIntensityRef.current = Math.min(hoverIntensityRef.current, 0.55);
  };

  const handleSeek = (event: MouseEvent<HTMLCanvasElement>) => {
    if (!isInteractive || !onSeek) return;
    event.preventDefault();
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = clamp((event.clientX - rect.left) / rect.width);
    onSeek(ratio);
  };

  return (
    <div
      ref={wrapRef}
      className={[
        'waveform-strip',
        isInteractive ? 'waveform-strip--interactive' : ''
      ].filter(Boolean).join(' ')}
    >
      {(state === 'loading' || state === 'placeholder') && <div className="waveform-strip__placeholder" aria-hidden="true" />}
      {state === 'ready' && data && (
        <canvas
          ref={canvasRef}
          className="waveform-strip__canvas"
          onMouseMove={updateHoverRatio}
          onMouseLeave={() => {
            setHoverRatio(null);
            hoverTargetIntensityRef.current = 0;
          }}
          onClick={handleSeek}
          aria-label="Waveform preview"
        />
      )}
    </div>
  );
}
