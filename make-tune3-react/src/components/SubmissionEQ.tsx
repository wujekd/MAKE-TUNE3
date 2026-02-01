import { useContext, useState } from 'react';
import { Potentiometer } from './Potentiometer';
import { AudioEngineContext } from '../audio-services/AudioEngineContext';
import { DeskToggle } from './DeskToggle';

interface SubmissionEQProps {
  muted: boolean;
  onMuteChange: (muted: boolean) => void;
}

export function SubmissionEQ({ muted, onMuteChange }: SubmissionEQProps) {
  const ctx = useContext(AudioEngineContext);
  const state = ctx?.state;
  const engine = ctx?.engine;

  const eq = state?.eq;
  const disabled = !engine || !eq;
  const [enabled, setEnabled] = useState(true);

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
  const [lpfEnabled, setLpfEnabled] = useState(true);
  const lastLpfRef = (globalThis as any).__lastLpfRef || { current: null as number | null };
  (globalThis as any).__lastLpfRef = lastLpfRef;

  const toggleLpf = (next: boolean) => {
    setLpfEnabled(next);
    if (!engine || !eq) return;
    if (!next) {
      const current = eq.highpass.frequency ?? 20;
      lastLpfRef.current = current;
      setHighpassFreq(20);
    } else {
      const restore = lastLpfRef.current && lastLpfRef.current > 20 ? lastLpfRef.current : eq.highpass.frequency ?? 40;
      setHighpassFreq(restore);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 8, alignItems: 'center' }}>
        <DeskToggle
          checked={enabled}
          onChange={toggleEq}
          size={18}
          onText="eq on"
          offText="eq off"
          disabled={disabled}
        />
        <DeskToggle
          checked={muted}
          onChange={onMuteChange}
          label={undefined}
          size={12}
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
          <DeskToggle checked={lpfEnabled} onChange={toggleLpf} size={14} onText="on" offText="off" disabled={disabled} />
          <div style={{ opacity: lpfEnabled ? 1 : 0.35, pointerEvents: lpfEnabled ? 'auto' as const : 'none' as const }}>
            <Potentiometer value={eq?.highpass.frequency ?? 20} min={20} max={1000} step={5} size={28} showValue={false}
              middleText="Hz" startText="20" endText="1k" onChange={setHighpassFreq} onInput={setHighpassFreq} />
          </div>
        </div>
      </div>
    </div>
  );
}

