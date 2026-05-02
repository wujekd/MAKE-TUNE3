import { useContext, useEffect, useRef, useState } from 'react';
import { Potentiometer } from './Potentiometer';
import { AudioEngineContext } from '../audio-services/AudioEngineContext';
import { DeskToggle } from './DeskToggle';
import type { EqState } from '../types';
import type { SubmissionSettings } from '../types/collaboration';

interface SubmissionEQProps {
  muted: boolean;
  onMuteChange: (muted: boolean) => void;
  currentEq?: EqState;
  trackKey?: string;
  savedEq?: SubmissionSettings['eq'];
}

const DEFAULT_HIGHPASS_Q = 0.7;
const RESET_BUTTON_STYLE = {
  position: 'absolute',
  top: -10,
  right: -14,
  width: 28,
  height: 28,
  borderRadius: 999,
  border: '1px solid rgba(255, 255, 255, 0.22)',
  background: 'linear-gradient(180deg, rgba(48, 68, 68, 0.96), rgba(11, 20, 20, 0.98))',
  boxShadow: '0 6px 14px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
  color: 'var(--white)',
  fontSize: 16,
  lineHeight: 1,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 0,
  zIndex: 2,
  transition: 'opacity 120ms ease, transform 120ms ease, box-shadow 120ms ease'
} as const;

function isSameNumber(a: number, b: number) {
  return Math.abs(a - b) < 0.001;
}

function matchesSavedEq(currentEq: EqState | undefined, savedEq: EqState | SubmissionSettings['eq'] | undefined) {
  if (!currentEq || !savedEq) return true;

  const hasEnabledFlag = Object.prototype.hasOwnProperty.call(savedEq.highpass, 'enabled');
  const savedHighpassFrequency = hasEnabledFlag && (savedEq.highpass as SubmissionSettings['eq']['highpass']).enabled === false
    ? 20
    : savedEq.highpass.frequency;

  return (
    isSameNumber(currentEq.highshelf.gain, savedEq.highshelf.gain) &&
    isSameNumber(currentEq.highshelf.frequency, savedEq.highshelf.frequency) &&
    isSameNumber(currentEq.param2.gain, savedEq.param2.gain) &&
    isSameNumber(currentEq.param2.frequency, savedEq.param2.frequency) &&
    isSameNumber(currentEq.param2.Q, savedEq.param2.Q) &&
    isSameNumber(currentEq.param1.gain, savedEq.param1.gain) &&
    isSameNumber(currentEq.param1.frequency, savedEq.param1.frequency) &&
    isSameNumber(currentEq.param1.Q, savedEq.param1.Q) &&
    isSameNumber(currentEq.highpass.frequency, savedHighpassFrequency)
  );
}

function toEqState(sourceEq: SubmissionSettings['eq'] | EqState, fallbackQ: number): EqState {
  const hasEnabledFlag = Object.prototype.hasOwnProperty.call(sourceEq.highpass, 'enabled');
  const highpassFrequency = hasEnabledFlag && (sourceEq.highpass as SubmissionSettings['eq']['highpass']).enabled === false
    ? 20
    : sourceEq.highpass.frequency;

  return {
    highpass: {
      frequency: highpassFrequency,
      Q: 'Q' in sourceEq.highpass ? sourceEq.highpass.Q : fallbackQ
    },
    param1: {
      frequency: sourceEq.param1.frequency,
      Q: sourceEq.param1.Q,
      gain: sourceEq.param1.gain
    },
    param2: {
      frequency: sourceEq.param2.frequency,
      Q: sourceEq.param2.Q,
      gain: sourceEq.param2.gain
    },
    highshelf: {
      frequency: sourceEq.highshelf.frequency,
      gain: sourceEq.highshelf.gain
    }
  };
}

export function SubmissionEQ({ muted, onMuteChange, currentEq, trackKey, savedEq }: SubmissionEQProps) {
  const ctx = useContext(AudioEngineContext);
  const engine = ctx?.engine;

  const eq = currentEq ?? ctx?.state?.eq;
  const disabled = !engine || !eq;
  const [enabled, setEnabled] = useState(true);
  const [lpfEnabled, setLpfEnabled] = useState((eq?.highpass.frequency ?? 20) > 20);
  const lastLpfRef = useRef<number | null>(null);
  const [baselineEq, setBaselineEq] = useState<EqState | undefined>(() =>
    savedEq
      ? toEqState(savedEq, currentEq?.highpass.Q ?? DEFAULT_HIGHPASS_Q)
      : currentEq
  );
  const resetEnabled = Boolean(eq && baselineEq && !matchesSavedEq(eq, baselineEq));

  useEffect(() => {
    setLpfEnabled((eq?.highpass.frequency ?? 20) > 20);
  }, [eq?.highpass.frequency]);

  useEffect(() => {
    if (!eq) return;
    if (savedEq) {
      setBaselineEq(toEqState(savedEq, eq.highpass.Q ?? DEFAULT_HIGHPASS_Q));
      return;
    }
    setBaselineEq(toEqState(eq, eq.highpass.Q ?? DEFAULT_HIGHPASS_Q));
  }, [trackKey, savedEq]);

  const toggleEq = (next: boolean) => {
    setEnabled(next);
    if (!engine) return;
    engine.setEqEnabled(next);
  };

  const setHighshelfGain = (gain: number) => {
    if (!engine || !eq) return;
    engine.setEq({ highshelf: { ...eq.highshelf, gain } });
  };
  const setHighshelfFreq = (frequency: number) => {
    if (!engine || !eq) return;
    engine.setEq({ highshelf: { ...eq.highshelf, frequency } });
  };
  const setParam2Gain = (gain: number) => {
    if (!engine || !eq) return;
    engine.setEq({ param2: { ...eq.param2, gain } });
  };
  const setParam2Freq = (frequency: number) => {
    if (!engine || !eq) return;
    engine.setEq({ param2: { ...eq.param2, frequency } });
  };
  const setParam2Q = (Q: number) => {
    if (!engine || !eq) return;
    engine.setEq({ param2: { ...eq.param2, Q } });
  };
  const setParam1Gain = (gain: number) => {
    if (!engine || !eq) return;
    engine.setEq({ param1: { ...eq.param1, gain } });
  };
  const setParam1Freq = (frequency: number) => {
    if (!engine || !eq) return;
    engine.setEq({ param1: { ...eq.param1, frequency } });
  };
  const setParam1Q = (Q: number) => {
    if (!engine || !eq) return;
    engine.setEq({ param1: { ...eq.param1, Q } });
  };
  const setHighpassFreq = (frequency: number) => {
    if (!engine || !eq) return;
    engine.setEq({ highpass: { ...eq.highpass, frequency } });
  };

  const rowStyle = { display: 'flex', gap: 10, justifyContent: 'center', alignItems: 'center' } as const;

  const toggleLpf = (next: boolean) => {
    setLpfEnabled(next);
    if (!engine || !eq) return;
    if (!next) {
      const current = eq.highpass.frequency ?? 20;
      if (current > 20) {
        lastLpfRef.current = current;
      }
      setHighpassFreq(20);
    } else {
      const restore = lastLpfRef.current && lastLpfRef.current > 20
        ? lastLpfRef.current
        : savedEq?.highpass.enabled === false
          ? 40
          : savedEq?.highpass.frequency ?? eq.highpass.frequency ?? 40;
      setHighpassFreq(restore);
    }
  };

  const resetEq = () => {
    if (!engine || !eq || !baselineEq) return;
    const highpassFrequency = baselineEq.highpass.frequency;
    if (highpassFrequency > 20) {
      lastLpfRef.current = highpassFrequency;
    }
    engine.setEq({
      highpass: { frequency: highpassFrequency, Q: eq.highpass.Q ?? DEFAULT_HIGHPASS_Q },
      param1: {
        frequency: baselineEq.param1.frequency,
        Q: baselineEq.param1.Q,
        gain: baselineEq.param1.gain
      },
      param2: {
        frequency: baselineEq.param2.frequency,
        Q: baselineEq.param2.Q,
        gain: baselineEq.param2.gain
      },
      highshelf: {
        frequency: baselineEq.highshelf.frequency,
        gain: baselineEq.highshelf.gain
      }
    });
  };

  return (
    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 6, overflow: 'visible' }}>
      <button
        type="button"
        aria-label="Reset EQ"
        title={resetEnabled ? 'Reset EQ to saved submission settings' : 'EQ matches saved submission settings'}
        onClick={resetEq}
        disabled={!resetEnabled}
        style={{
          ...RESET_BUTTON_STYLE,
          cursor: resetEnabled ? 'pointer' : 'default',
          opacity: resetEnabled ? 1 : 0.35,
          transform: resetEnabled ? 'translateY(0)' : 'translateY(1px)',
          boxShadow: resetEnabled
            ? '0 8px 16px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.14)'
            : RESET_BUTTON_STYLE.boxShadow
        }}
      >
        ↺
      </button>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 6, alignItems: 'center' }}>
        <DeskToggle
          checked={enabled}
          onChange={toggleEq}
          size={5}
          onText="eq on"
          offText="eq off"
          disabled={disabled}
        />
        <DeskToggle
          checked={muted}
          onChange={onMuteChange}
          label={undefined}
          size={4}
          colorOn="#d33"
          onText="unmute"
          offText="mute"
        />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ ...rowStyle, gap: 22 }}>
          <Potentiometer value={eq?.highshelf.gain ?? 0} min={-18} max={18} step={0.1} size={30} showValue={false}
            middleText="dB" startText="-18" endText="+18" onChange={setHighshelfGain} onInput={setHighshelfGain} />
          <Potentiometer value={eq?.highshelf.frequency ?? 8000} min={2000} max={16000} step={10} size={28} showValue={false}
            middleText="Hz" startText="2k" endText="16k" onChange={setHighshelfFreq} onInput={setHighshelfFreq} />
        </div>
        <div style={rowStyle}>
          <Potentiometer value={eq?.param2.gain ?? 0} min={-18} max={18} step={0.1} size={26} showValue={false}
            middleText="dB" startText="-18" endText="+18" onChange={setParam2Gain} onInput={setParam2Gain} />
          <div style={{ marginTop: -16 }}>
            <Potentiometer value={eq?.param2.frequency ?? 3000} min={500} max={8000} step={10} size={20} showValue={false}
              middleText="Hz" startText="500" endText="8k" onChange={setParam2Freq} onInput={setParam2Freq} />
          </div>
          <Potentiometer value={eq?.param2.Q ?? 1} min={0.1} max={10} step={0.05} size={20} showValue={false}
            middleText="Q" startText="0.1" endText="10" onChange={setParam2Q} onInput={setParam2Q} />
        </div>
        <div style={rowStyle}>
          <Potentiometer value={eq?.param1.gain ?? 0} min={-18} max={18} step={0.1} size={26} showValue={false}
            middleText="dB" startText="-18" endText="+18" onChange={setParam1Gain} onInput={setParam1Gain} />
          <div style={{ marginTop: -16 }}>
            <Potentiometer value={eq?.param1.frequency ?? 250} min={40} max={1000} step={5} size={20} showValue={false}
              middleText="Hz" startText="40" endText="1k" onChange={setParam1Freq} onInput={setParam1Freq} />
          </div>
          <Potentiometer value={eq?.param1.Q ?? 1} min={0.1} max={10} step={0.05} size={20} showValue={false}
            middleText="Q" startText="0.1" endText="10" onChange={setParam1Q} onInput={setParam1Q} />
        </div>
        <div style={rowStyle}>
          <DeskToggle checked={lpfEnabled} onChange={toggleLpf} size={4} onText="on" offText="off" disabled={disabled} />
          <div style={{ opacity: lpfEnabled ? 1 : 0.35, pointerEvents: lpfEnabled ? 'auto' as const : 'none' as const }}>
            <Potentiometer value={eq?.highpass.frequency ?? 20} min={20} max={1000} step={5} size={28} showValue={false}
              middleText="Hz" startText="20" endText="1k" onChange={setHighpassFreq} onInput={setHighpassFreq} />
          </div>
        </div>
      </div>
    </div>
  );
}
