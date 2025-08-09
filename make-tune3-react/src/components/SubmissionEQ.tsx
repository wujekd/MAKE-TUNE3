import { useContext, useState } from 'react';
import { Potentiometer } from './Potentiometer';
import { AudioEngineContext } from '../audio-services/AudioEngineContext';
import { DeskToggle } from './DeskToggle';

export function SubmissionEQ() {
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
  const setParam1Gain = (gain: number) => {
    if (!engine || !eq) return;
    engine.setEq({ param1: { ...eq.param1, gain } });
  };
  const setParam1Freq = (frequency: number) => {
    if (!engine || !eq) return;
    engine.setEq({ param1: { ...eq.param1, frequency } });
  };
  const setHighpassFreq = (frequency: number) => {
    if (!engine || !eq) return;
    engine.setEq({ highpass: { ...eq.highpass, frequency } });
  };

  const gridStyle = {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gridTemplateRows: 'repeat(4, auto)',
    // gap: '23px',
    columnGap: '21px',
    alignItems: 'center',
    justifyItems: 'center'
  } as const;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <DeskToggle
          checked={enabled}
          onChange={toggleEq}
          size={18}
          onText="eq on"
          offText="eq off"
          disabled={disabled}
        />
      </div>
      <div style={gridStyle}>
      <Potentiometer
        value={eq?.highshelf.gain ?? 0}
        min={-18}
        max={18}
        step={0.1}
        size={30}
        showValue={false}
        middleText="dB"
        startText="-18"
        endText="+18"
        onChange={setHighshelfGain}
        onInput={setHighshelfGain}
      />
      <Potentiometer
        value={eq?.highshelf.frequency ?? 8000}
        min={2000}
        max={16000}
        step={10}
        size={28}
        showValue={false}
        middleText="Hz"
        startText="2k"
        endText="16k"
        onChange={setHighshelfFreq}
        onInput={setHighshelfFreq}
      />
      <Potentiometer
        value={eq?.param2.gain ?? 0}
        min={-18}
        max={18}
        step={0.1}
        size={28}
        showValue={false}
        middleText="dB"
        startText="-18"
        endText="+18"
        onChange={setParam2Gain}
        onInput={setParam2Gain}
      />
      <Potentiometer
        value={eq?.param2.frequency ?? 3000}
        min={500}
        max={8000}
        step={10}
        size={28}
        showValue={false}
        middleText="Hz"
        startText="500"
        endText="8k"
        onChange={setParam2Freq}
        onInput={setParam2Freq}
      />
      <Potentiometer
        value={eq?.param1.gain ?? 0}
        min={-18}
        max={18}
        step={0.1}
        size={28}
        showValue={false}
        middleText="dB"
        startText="-18"
        endText="+18"
        onChange={setParam1Gain}
        onInput={setParam1Gain}
      />
      <Potentiometer
        value={eq?.param1.frequency ?? 250}
        min={40}
        max={1000}
        step={5}
        size={28}
        showValue={false}
        middleText="Hz"
        startText="40"
        endText="1k"
        onChange={setParam1Freq}
        onInput={setParam1Freq}
      />

      <Potentiometer
        value={eq?.highpass.frequency ?? 20}
        min={20}
        max={1000}
        step={5}
        size={28}
        showValue={false}
        middleText="Hz"
        startText="20"
        endText="1k"
        onChange={setHighpassFreq}
        onInput={setHighpassFreq}
      />
      <div></div>
      </div>
    </div>
  );
}

