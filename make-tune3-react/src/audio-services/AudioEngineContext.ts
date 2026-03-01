import { createContext } from 'react';
import type { AudioEngine } from './audio-engine';
import type { AudioState } from '../types';

// Context value holds both the engine and its current state
export interface AudioEngineContextValue {
  engine: AudioEngine;
  state: AudioState;
}

// Create context with null default
export const AudioEngineContext = createContext<AudioEngineContextValue | null>(null);
