import React, { createContext, useRef, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { AudioEngine } from './audio-engine';
import type { AudioState } from '../types';

// Context value holds both the engine and its current state
interface AudioEngineContextValue {
  engine: AudioEngine;
  state: AudioState;
}

// Create context with null default
export const AudioEngineContext = createContext<AudioEngineContextValue | null>(null);

export function AudioEngineProvider({ children }: { children: ReactNode }) {
  // Refs to two <audio> elements
  const player1Ref = useRef<HTMLAudioElement>(null);
  const player2Ref = useRef<HTMLAudioElement>(null);
  
  // Use ref to store engine to prevent recreation
  const engineRef = useRef<AudioEngine | null>(null);
  const [state, setState] = useState<AudioState | null>(null);

  useEffect(() => {
    // Instantiate engine once refs are available and not already created
    if (!engineRef.current && player1Ref.current && player2Ref.current) {
      const audioEngine = new AudioEngine(player1Ref.current, player2Ref.current);
      audioEngine.setCallbacks((newState: AudioState) => {
        setState(newState);
      });
      engineRef.current = audioEngine;
      setState(audioEngine.getState());
    }
  }, []); // never rerender

  return (
    <>
      {/* Audio elements controlled by AudioEngine - visible for debugging */}
      <audio ref={player1Ref} controls />
      <audio ref={player2Ref} controls />
      {/* Only provide context to children when engine and state are ready */}
      {engineRef.current && state && (
        <AudioEngineContext.Provider value={{ engine: engineRef.current, state }}>
          {children}
        </AudioEngineContext.Provider>
      )}
    </>
  );
}
