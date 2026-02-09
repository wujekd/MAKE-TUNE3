import React, { useMemo, useState, useRef, useEffect, useCallback } from 'react';

interface WeightedFaderProps {
    /** Current actual volume value (curved) */
    value: number;
    /** Minimum volume value */
    min?: number;
    /** Maximum volume value */
    max?: number;
    /** Step size for the underlying slider */
    step?: number;
    /** Curve exponent - higher = more sensitive at top, default 2 */
    exponent?: number;
    /** Called with the curved volume value when slider changes */
    onChange: (value: number) => void;
    /** CSS class name for the input element */
    className?: string;
    /** HTML id for the input element */
    id?: string;
    /** Whether the slider is disabled */
    disabled?: boolean;
}

/**
 * A weighted volume fader that applies an exponential curve transformation.
 * This makes volume control feel more natural - the top of the slider
 * produces larger volume changes while the bottom provides fine control.
 * 
 * The transformation: actualVolume = sliderPosition^exponent
 * Inverse: sliderPosition = actualVolume^(1/exponent)
 * 
 * Hold SHIFT while dragging for precise adjustment (20x finer control).
 */
export function WeightedFader({
    value,
    min = 0,
    max = 1,
    step = 0.05,
    exponent = 2,
    onChange,
    className = 'vertical-slider mixer1-fader',
    id,
    disabled = false
}: WeightedFaderProps) {
    const [isDragging, setIsDragging] = useState(false);
    const startYRef = useRef<number>(0);
    const startValueRef = useRef<number>(0);
    const sliderRef = useRef<HTMLInputElement>(null);

    // Convert actual volume to slider position (0-1 linear range)
    const sliderPosition = useMemo(() => {
        if (max === min) return 0;
        // Normalize value to 0-1 range
        const normalized = Math.max(0, Math.min(1, (value - min) / (max - min)));
        // Apply inverse curve: sliderPos = volume^(1/exponent)
        return Math.pow(normalized, 1 / exponent);
    }, [value, min, max, exponent]);

    // Handle native slider change (for click-to-position)
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (isDragging) return; // Skip during drag - we handle it manually
        const linearPosition = parseFloat(e.target.value);
        // Apply curve: volume = sliderPos^exponent
        const curvedNormalized = Math.pow(linearPosition, exponent);
        // Scale back to actual range
        const actualValue = min + curvedNormalized * (max - min);
        onChange(actualValue);
    };

    // Handle mouse down - start drag tracking
    const handleMouseDown = (e: React.MouseEvent) => {
        if (disabled) return;
        setIsDragging(true);
        startYRef.current = e.clientY;
        startValueRef.current = sliderPosition;
        // Prevent text selection during drag
        document.body.style.userSelect = 'none';
        document.body.style.cursor = 'ns-resize';
    };

    // Handle mouse move during drag
    const handleMouseMove = useCallback((e: MouseEvent) => {
        // Fixed height matching the fader container (184px in non-compact mode)
        // offsetHeight doesn't work correctly for CSS-rotated vertical sliders
        const sliderHeight = 184;

        const dy = e.clientY - startYRef.current;
        // Without shift: 1:1 with mouse (full slider height = full range)
        // With shift: half speed (need to move twice as far)
        const speedMultiplier = e.shiftKey ? 0.5 : 1;
        // Calculate delta in linear space (inverted because Y grows downward)
        const linearDelta = (-dy / sliderHeight) * speedMultiplier;
        // Apply delta to starting position
        let newLinear = startValueRef.current + linearDelta;
        newLinear = Math.min(1, Math.max(0, newLinear));
        // Convert through curve to actual value
        const curvedNormalized = Math.pow(newLinear, exponent);
        let actualValue = min + curvedNormalized * (max - min);
        // Snap to step
        actualValue = Math.round(actualValue / step) * step;
        actualValue = Math.min(max, Math.max(min, actualValue));
        onChange(actualValue);
    }, [exponent, min, max, step, onChange]);

    // Handle mouse up - end drag
    const handleMouseUp = useCallback(() => {
        setIsDragging(false);
        document.body.style.userSelect = '';
        document.body.style.cursor = '';
    }, []);

    // Attach/detach global mouse listeners during drag
    useEffect(() => {
        if (!isDragging) return;
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, handleMouseMove, handleMouseUp]);

    return (
        <input
            ref={sliderRef}
            type="range"
            className={className}
            id={id}
            min="0"
            max="1"
            step={step / (max - min)} // Scale step to normalized range
            value={sliderPosition}
            onChange={handleChange}
            onMouseDown={handleMouseDown}
            disabled={disabled}
        />
    );
}
