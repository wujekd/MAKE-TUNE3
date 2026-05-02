import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { SubmissionEQ } from '../../components/SubmissionEQ';
import { AudioEngineContext } from '../../audio-services/AudioEngineContext';
import type { AudioState } from '../../types';
import type { SubmissionSettings } from '../../types/collaboration';

const savedEq: SubmissionSettings['eq'] = {
  highshelf: { gain: 2, frequency: 9000 },
  param2: { gain: 1.5, frequency: 3200, Q: 1.2 },
  param1: { gain: -2, frequency: 180, Q: 0.8 },
  highpass: { frequency: 20, enabled: false }
};

function createState(overrides?: Partial<AudioState['eq']>): AudioState {
  return {
    playerController: { playingFavourite: false, pastStagePlayback: false, currentTrackId: 0 },
    player1: { isPlaying: false, currentTime: 0, duration: 0, volume: 1, source: null, hasEnded: false, error: null },
    player2: { isPlaying: false, currentTime: 0, duration: 0, volume: 1, source: null, hasEnded: false, error: null },
    master: { volume: 1 },
    eq: {
      highpass: { frequency: 20, Q: 0.7 },
      param1: { ...savedEq.param1 },
      param2: { ...savedEq.param2 },
      highshelf: { ...savedEq.highshelf },
      ...overrides
    }
  };
}

describe('SubmissionEQ', () => {
  it('enables reset only when the current EQ differs from the saved submission EQ', () => {
    const engine = {
      setEq: vi.fn(),
      setEqEnabled: vi.fn()
    };

    const { rerender } = render(
      <AudioEngineContext.Provider value={{ engine: engine as any, state: createState() }}>
        <SubmissionEQ muted={false} onMuteChange={vi.fn()} trackKey="track-1" savedEq={savedEq} />
      </AudioEngineContext.Provider>
    );

    const resetButton = screen.getByRole('button', { name: /reset eq/i });
    expect(resetButton).toBeDisabled();

    rerender(
      <AudioEngineContext.Provider
        value={{
          engine: engine as any,
          state: createState({
            highpass: { frequency: 145, Q: 0.7 }
          })
        }}
      >
        <SubmissionEQ muted={false} onMuteChange={vi.fn()} trackKey="track-1" savedEq={savedEq} />
      </AudioEngineContext.Provider>
    );

    expect(screen.getByRole('button', { name: /reset eq/i })).toBeEnabled();

    fireEvent.click(screen.getByRole('button', { name: /reset eq/i }));

    expect(engine.setEq).toHaveBeenCalledWith({
      highpass: { frequency: 20, Q: 0.7 },
      param1: {
        frequency: savedEq.param1.frequency,
        Q: savedEq.param1.Q,
        gain: savedEq.param1.gain
      },
      param2: {
        frequency: savedEq.param2.frequency,
        Q: savedEq.param2.Q,
        gain: savedEq.param2.gain
      },
      highshelf: {
        frequency: savedEq.highshelf.frequency,
        gain: savedEq.highshelf.gain
      }
    });
  });

  it('keeps the initial track EQ as the reset baseline when saved submission EQ is unavailable', () => {
    const engine = {
      setEq: vi.fn(),
      setEqEnabled: vi.fn()
    };

    const { rerender } = render(
      <AudioEngineContext.Provider value={{ engine: engine as any, state: createState() }}>
        <SubmissionEQ muted={false} onMuteChange={vi.fn()} trackKey="track-1" currentEq={createState().eq} />
      </AudioEngineContext.Provider>
    );

    expect(screen.getByRole('button', { name: /reset eq/i })).toBeDisabled();

    const changedEq = createState({
      param1: { gain: 4, frequency: 180, Q: 0.8 }
    }).eq;

    rerender(
      <AudioEngineContext.Provider value={{ engine: engine as any, state: createState({ param1: { gain: 4, frequency: 180, Q: 0.8 } }) }}>
        <SubmissionEQ muted={false} onMuteChange={vi.fn()} trackKey="track-1" currentEq={changedEq} />
      </AudioEngineContext.Provider>
    );

    fireEvent.click(screen.getByRole('button', { name: /reset eq/i }));

    expect(screen.getByRole('button', { name: /reset eq/i })).toBeEnabled();
    expect(engine.setEq).toHaveBeenCalledWith({
      highpass: { frequency: 20, Q: 0.7 },
      param1: {
        frequency: savedEq.param1.frequency,
        Q: savedEq.param1.Q,
        gain: savedEq.param1.gain
      },
      param2: {
        frequency: savedEq.param2.frequency,
        Q: savedEq.param2.Q,
        gain: savedEq.param2.gain
      },
      highshelf: {
        frequency: savedEq.highshelf.frequency,
        gain: savedEq.highshelf.gain
      }
    });
  });
});
