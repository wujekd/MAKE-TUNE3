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
    const lastYRef = useRef<number>(0);
    const lastShiftRef = useRef<boolean>(false);
    const currentLinearRef = useRef<number>(0);
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

    // Handle mouse down - detect if clicking thumb or track
    const handleMouseDown = (e: React.MouseEvent) => {
        if (disabled) return;

        const slider = sliderRef.current;
        if (!slider) return;

        const rect = slider.getBoundingClientRect();
        const sliderHeight = rect.height;

        // For vertical slider: calculate click position as 0-1 (bottom=0, top=1)
        const clickY = e.clientY - rect.top;
        const clickPosition = 1 - (clickY / sliderHeight);

        // Calculate where the thumb currently is (0-1)
        const thumbPosition = sliderPosition;

        // Thumb hit zone - about 15% of slider height
        const thumbHitZone = 0.15;
        const isClickOnThumb = Math.abs(clickPosition - thumbPosition) < thumbHitZone;

        if (isClickOnThumb) {
            // Clicked on thumb - enable drag mode
            setIsDragging(true);
            startYRef.current = e.clientY;
            lastYRef.current = e.clientY;
            startValueRef.current = sliderPosition;
            currentLinearRef.current = sliderPosition;
            lastShiftRef.current = e.shiftKey;
            // Prevent text selection during drag
            document.body.style.userSelect = 'none';
            document.body.style.cursor = 'ns-resize';
            // Prevent the native slider from also responding
            e.preventDefault();
        }
        // If not on thumb, let the native slider handle click-to-position via handleChange
    };

    // Handle mouse move during drag
    const handleMouseMove = useCallback((e: MouseEvent) => {
        // Pixels for full range movement (baseline reference)
        const sliderHeight = 184;

        // SENSITIVITY CONTROLS - adjust these:
        // normalSensitivity: 1.0 = match slider height, 1.5 = 50% more sensitive, 2.0 = twice as sensitive
        // shiftSensitivity: 0.1 = 10x slower when shift held
        const normalSensitivity = 1.2;  // ← Make slider more sensitive without shift
        const shiftSensitivity = 0.1;   // ← Fine control with shift

        // Check if shift state changed - if so, reset anchor to current position
        if (e.shiftKey !== lastShiftRef.current) {
            lastYRef.current = e.clientY;
            lastShiftRef.current = e.shiftKey;
        }

        // Calculate delta from last position (incremental, not absolute)
        const dy = e.clientY - lastYRef.current;
        lastYRef.current = e.clientY;

        // Apply appropriate sensitivity
        const speedMultiplier = e.shiftKey ? shiftSensitivity : normalSensitivity;

        // Calculate incremental delta in linear space (inverted because Y grows downward)
        const linearDelta = (-dy / sliderHeight) * speedMultiplier;

        // Apply delta to current position (incremental)
        let newLinear = currentLinearRef.current + linearDelta;
        newLinear = Math.min(1, Math.max(0, newLinear));
        currentLinearRef.current = newLinear;

        // Convert through curve to actual value
        const curvedNormalized = Math.pow(newLinear, exponent);
        const actualValue = min + curvedNormalized * (max - min);
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
