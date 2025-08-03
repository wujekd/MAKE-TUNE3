# React Audio Engine Implementation Guide

## Overview

This guide shows how to create a React TypeScript app that replicates the **exact functionality** of the `audio-engine-test` while seamlessly integrating with the existing AudioEngine class. The React app will provide the same features: dual-player audio control, past stage playback, volume mixing, and real-time state updates.

## Project Setup

### 1. Create React App

```bash
npx create-react-app react-audio-player --template typescript
cd react-audio-player
npm install
```

### 2. Copy Audio Engine Assets

Create `public/audio-engine/` and copy these files from your `audio-engine-test/`:

```
public/
├── audio-engine/
│   ├── audio-engine.js
│   ├── types.js
│   ├── test-audio/
│   │   ├── mock-audio.js
│   │   └── [all audio files]
│   └── styles.css
```

## Core Integration Strategy

### Audio Engine Service Wrapper

```typescript
// src/services/AudioEngineService.ts
declare global {
  interface Window {
    AudioEngine: any;
  }
}

export interface AudioState {
  player1: {
    isPlaying: boolean;
    currentTime: number;
    duration: number;
    volume: number;
    source: string | null;
    hasEnded: boolean;
    error: string | null;
  };
  player2: {
    isPlaying: boolean;
    currentTime: number;
    duration: number;
    volume: number;
    source: string | null;
    hasEnded: boolean;
    error: string | null;
  };
  master: {
    volume: number;
  };
}

class AudioEngineService {
  private engine: any = null;
  private stateCallbacks = new Set<(state: AudioState) => void>();

  async initialize(): Promise<void> {
    // Load audio engine script
    await this.loadScript('/audio-engine/audio-engine.js');
    
    // Create audio elements
    this.createAudioElements();
    
    // Initialize engine
    const player1 = document.getElementById('react-audio-player-1') as HTMLAudioElement;
    const player2 = document.getElementById('react-audio-player-2') as HTMLAudioElement;
    
    this.engine = new window.AudioEngine(player1, player2);
    this.engine.setCallbacks((state: AudioState) => {
      this.stateCallbacks.forEach(callback => callback(state));
    });
  }

  private loadScript(src: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = src;
      script.type = 'module';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Failed to load ${src}`));
      document.head.appendChild(script);
    });
  }

  private createAudioElements(): void {
    // Remove existing elements if any
    ['react-audio-player-1', 'react-audio-player-2'].forEach(id => {
      const existing = document.getElementById(id);
      if (existing) existing.remove();
    });

    // Create new audio elements
    const player1 = document.createElement('audio');
    player1.id = 'react-audio-player-1';
    player1.style.display = 'none';
    
    const player2 = document.createElement('audio');
    player2.id = 'react-audio-player-2';
    player2.style.display = 'none';
    
    document.body.appendChild(player1);
    document.body.appendChild(player2);
  }

  // Subscribe to state changes
  onStateChange(callback: (state: AudioState) => void): () => void {
    this.stateCallbacks.add(callback);
    return () => this.stateCallbacks.delete(callback);
  }

  // Proxy all audio engine methods
  playSubmission(submissionSrc: string, backingSrc: string): void {
    this.engine?.playSubmission(submissionSrc, backingSrc);
  }

  playPastStage(src: string): void {
    this.engine?.playPastStage(src);
  }

  pause(): void {
    this.engine?.pause();
  }

  toggleP2(): void {
    this.engine?.toggleP2();
  }

  toggleBoth(): void {
    this.engine?.toggleBoth();
  }

  seek(time: number, pastStagePlayback: boolean = false): void {
    this.engine?.seek(time, pastStagePlayback);
  }

  setVolume(playerId: 1 | 2, volume: number): void {
    this.engine?.setVolume(playerId, volume);
  }

  setMasterVolume(volume: number): void {
    this.engine?.setMasterVolume(volume);
  }

  getState(): AudioState | null {
    return this.engine?.getState() || null;
  }
}

export const audioService = new AudioEngineService();
```

## Mock Audio Data Integration

```typescript
// src/data/audioData.ts
declare global {
  interface Window {
    audioFiles: any;
  }
}

export interface AudioFiles {
  player1Files: string[];
  player2Files: string[];
  pastStageFiles: string[];
}

class AudioDataService {
  private audioFiles: AudioFiles | null = null;

  async loadAudioFiles(): Promise<AudioFiles> {
    if (this.audioFiles) return this.audioFiles;

    // Load mock audio data
    await this.loadScript('/audio-engine/test-audio/mock-audio.js');
    
    this.audioFiles = window.audioFiles;
    return this.audioFiles;
  }

  private loadScript(src: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.type = 'module';
      script.onload = () => resolve();
      script.onerror = () => reject();
      document.head.appendChild(script);
    });
  }

  getAudioFiles(): AudioFiles | null {
    return this.audioFiles;
  }
}

export const audioDataService = new AudioDataService();
```

## React Hooks

```typescript
// src/hooks/useAudioEngine.ts
import { useEffect, useState } from 'react';
import { audioService, AudioState } from '../services/AudioEngineService';

export const useAudioEngine = () => {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audioState, setAudioState] = useState<AudioState | null>(null);

  useEffect(() => {
    const initialize = async () => {
      try {
        await audioService.initialize();
        setIsReady(true);
        
        // Subscribe to state changes
        const unsubscribe = audioService.onStateChange(setAudioState);
        return unsubscribe;
      } catch (err) {
        setError('Failed to initialize audio engine');
      }
    };

    const cleanup = initialize();
    return () => {
      cleanup.then(unsub => unsub?.());
    };
  }, []);

  return {
    isReady,
    error,
    audioState,
    audioService
  };
};
```

```typescript
// src/hooks/useAudioData.ts
import { useEffect, useState } from 'react';
import { audioDataService, AudioFiles } from '../data/audioData';

export const useAudioData = () => {
  const [audioFiles, setAudioFiles] = useState<AudioFiles | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const files = await audioDataService.loadAudioFiles();
        setAudioFiles(files);
      } catch (error) {
        console.error('Failed to load audio files:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  return { audioFiles, isLoading };
};
```

## Player Controller Hook

```typescript
// src/hooks/usePlayerController.ts
import { useState, useCallback } from 'react';
import { audioService } from '../services/AudioEngineService';
import { AudioFiles } from '../data/audioData';

export const usePlayerController = (audioFiles: AudioFiles | null) => {
  const [currentTrackIndex, setCurrentTrackIndex] = useState(-1);
  const [pastStagePlayback, setPastStagePlayback] = useState(false);
  const [backingTrackSrc] = useState(audioFiles?.player2Files[0] || '');

  const playSubmission = useCallback((index: number) => {
    if (!audioFiles || index < 0 || index >= audioFiles.player1Files.length) return;
    
    if (pastStagePlayback) setPastStagePlayback(false);
    setCurrentTrackIndex(index);
    
    const trackPath = audioFiles.player1Files[index];
    audioService.playSubmission(trackPath, backingTrackSrc);
  }, [audioFiles, backingTrackSrc, pastStagePlayback]);

  const playPastSubmission = useCallback((index: number) => {
    if (!audioFiles || index < 0 || index >= audioFiles.pastStageFiles.length) return;
    
    if (!pastStagePlayback) setPastStagePlayback(true);
    audioService.playPastStage(audioFiles.pastStageFiles[index]);
  }, [audioFiles, pastStagePlayback]);

  const nextTrack = useCallback(() => {
    if (!audioFiles || currentTrackIndex >= audioFiles.player1Files.length - 1) return;
    playSubmission(currentTrackIndex + 1);
  }, [audioFiles, currentTrackIndex, playSubmission]);

  const previousTrack = useCallback(() => {
    if (currentTrackIndex <= 0) return;
    playSubmission(currentTrackIndex - 1);
  }, [currentTrackIndex, playSubmission]);

  const togglePlayPause = useCallback(() => {
    if (pastStagePlayback) {
      audioService.toggleP2();
    } else {
      audioService.toggleBoth();
    }
  }, [pastStagePlayback]);

  return {
    currentTrackIndex,
    pastStagePlayback,
    playSubmission,
    playPastSubmission,
    nextTrack,
    previousTrack,
    togglePlayPause,
    canGoNext: audioFiles ? currentTrackIndex < audioFiles.player1Files.length - 1 : false,
    canGoPrev: currentTrackIndex > 0
  };
};
```

## Main App Component

```typescript
// src/App.tsx
import React from 'react';
import { AudioPlayer } from './components/AudioPlayer';
import './App.css';

const App: React.FC = () => {
  return (
    <div className="App">
      <AudioPlayer />
    </div>
  );
};

export default App;
```

## Core Audio Player Component

```typescript
// src/components/AudioPlayer.tsx
import React from 'react';
import { useAudioEngine } from '../hooks/useAudioEngine';
import { useAudioData } from '../hooks/useAudioData';
import { usePlayerController } from '../hooks/usePlayerController';
import { DebugPanel } from './DebugPanel';
import { TrackList } from './TrackList';
import { MixerControls } from './MixerControls';
import { formatTime } from '../utils/formatters';

export const AudioPlayer: React.FC = () => {
  const { isReady, error, audioState, audioService } = useAudioEngine();
  const { audioFiles, isLoading } = useAudioData();
  const controller = usePlayerController(audioFiles);

  if (error) {
    return <div className="error">Error: {error}</div>;
  }

  if (!isReady || isLoading) {
    return <div className="loading">Loading Audio Engine...</div>;
  }

  return (
    <div className="main-container">
      <div className="info-top">
        <h2>Audio Engine Test</h2>
        <DebugPanel audioState={audioState} />
      </div>
      
      <div className="submissions-section">
        <div className="audio-player-section">
          <div className="audio-player-title">Audio Player 1</div>
          <TrackList 
            tracks={audioFiles?.player1Files || []}
            onTrackClick={controller.playSubmission}
            currentIndex={controller.currentTrackIndex}
          />
        </div>
        
        <div className="audio-player-section">
          <div className="audio-player-title">Past Stages</div>
          <TrackList 
            tracks={audioFiles?.pastStageFiles || []}
            onTrackClick={controller.playPastSubmission}
          />
        </div>
      </div>
      
      <MixerControls 
        audioState={audioState}
        audioService={audioService}
        controller={controller}
      />
    </div>
  );
};
```

## Supporting Components

```typescript
// src/components/DebugPanel.tsx
import React from 'react';
import { AudioState } from '../services/AudioEngineService';
import { formatTime } from '../utils/formatters';

interface DebugPanelProps {
  audioState: AudioState | null;
}

export const DebugPanel: React.FC<DebugPanelProps> = ({ audioState }) => {
  if (!audioState) return <div>No audio state</div>;

  return (
    <div className="debug-info">
      <div className="debug-grid">
        <div className="debug-column">
          <h4>Audio Engine</h4>
          <p>Context: <span className="debug-value">Active</span></p>
          <p>Master Volume: <span className="debug-value">{audioState.master.volume.toFixed(1)}</span></p>
        </div>
        
        <div className="debug-column">
          <h4>Player 1</h4>
          <p>Status: <span className="debug-value">{audioState.player1.isPlaying ? 'Playing' : 'Stopped'}</span></p>
          <p>Source: <span className="debug-value">{audioState.player1.source || 'None'}</span></p>
          <p>Time: <span className="debug-value">{formatTime(audioState.player1.currentTime)} / {formatTime(audioState.player1.duration)}</span></p>
          <p>Volume: <span className="debug-value">{audioState.player1.volume.toFixed(1)}</span></p>
        </div>
        
        <div className="debug-column">
          <h4>Player 2</h4>
          <p>Status: <span className="debug-value">{audioState.player2.isPlaying ? 'Playing' : 'Stopped'}</span></p>
          <p>Source: <span className="debug-value">{audioState.player2.source || 'None'}</span></p>
          <p>Time: <span className="debug-value">{formatTime(audioState.player2.currentTime)} / {formatTime(audioState.player2.duration)}</span></p>
          <p>Volume: <span className="debug-value">{audioState.player2.volume.toFixed(1)}</span></p>
        </div>
      </div>
    </div>
  );
};
```

```typescript
// src/components/TrackList.tsx
import React from 'react';

interface TrackListProps {
  tracks: string[];
  onTrackClick: (index: number) => void;
  currentIndex?: number;
}

export const TrackList: React.FC<TrackListProps> = ({ tracks, onTrackClick, currentIndex }) => {
  return (
    <ul>
      {tracks.map((track, index) => (
        <li 
          key={index}
          onClick={() => onTrackClick(index)}
          className={index === currentIndex ? 'active' : ''}
          style={{ cursor: 'pointer', padding: '4px 8px' }}
        >
          {track}
        </li>
      ))}
    </ul>
  );
};
```

```typescript
// src/components/MixerControls.tsx
import React from 'react';
import { AudioState, audioService } from '../services/AudioEngineService';
import { formatTime } from '../utils/formatters';

interface MixerControlsProps {
  audioState: AudioState | null;
  audioService: typeof audioService;
  controller: any;
}

export const MixerControls: React.FC<MixerControlsProps> = ({ 
  audioState, 
  audioService: service, 
  controller 
}) => {
  if (!audioState) return null;

  const currentTime = controller.pastStagePlayback 
    ? audioState.player2.currentTime 
    : audioState.player1.currentTime;
  const duration = controller.pastStagePlayback 
    ? audioState.player2.duration 
    : audioState.player1.duration;
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const isPlaying = audioState.player1.isPlaying || audioState.player2.isPlaying;

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newProgress = parseFloat(e.target.value);
    if (duration > 0) {
      const newTime = (newProgress / 100) * duration;
      service.seek(newTime, controller.pastStagePlayback);
    }
  };

  return (
    <section className="mixer-section">
      {/* Transport Controls */}
      <div className="transport">
        <button 
          onClick={controller.previousTrack}
          disabled={!controller.canGoPrev}
        >
          ⏮
        </button>
        
        <button onClick={controller.togglePlayPause}>
          {isPlaying ? '⏸' : '▶️'}
        </button>
        
        <button 
          onClick={controller.nextTrack}
          disabled={!controller.canGoNext}
        >
          ⏭
        </button>
      </div>

      {/* Time Control */}
      <div className="time-control">
        <div className="time-display">
          <span>{formatTime(currentTime)}</span>
          <span>/</span>
          <span>{formatTime(duration)}</span>
        </div>
        <input 
          type="range"
          min="0" 
          max="100"
          step="0.1"
          value={progress}
          onChange={handleSeek}
        />
      </div>

      {/* Volume Controls */}
      <div className="channels-container">
        <div className="channel">
          <span>Submission</span>
          <input 
            type="range"
            min="0" 
            max="2"
            step="0.01"
            value={audioState.player1.volume}
            onChange={(e) => service.setVolume(1, parseFloat(e.target.value))}
          />
        </div>
        
        <div className="channel">
          <span>Master</span>
          <input 
            type="range"
            min="0" 
            max="1"
            step="0.01"
            value={audioState.master.volume}
            onChange={(e) => service.setMasterVolume(parseFloat(e.target.value))}
          />
        </div>
      </div>
    </section>
  );
};
```

## Utility Functions

```typescript
// src/utils/formatters.ts
export const formatTime = (seconds: number): string => {
  if (!seconds || isNaN(seconds)) return '0:00';
  
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};
```

## CSS Integration

```css
/* src/App.css */
@import url('../public/audio-engine/styles.css');

.error, .loading {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 200px;
  font-size: 18px;
}

.error { color: #ff4444; }
.loading { color: #666; }

.active {
  background-color: #007bff;
  color: white;
}
```

## Key Features Implemented

✅ **Exact Same Functionality**
- Dual-player audio control
- Past stage playback mode
- Volume mixing (submission + master)
- Real-time seeking with pastStagePlayback awareness
- Track navigation (next/previous)
- State synchronization

✅ **Seamless Audio Engine Integration**
- Uses existing AudioEngine class without modification
- Preserves all existing methods and functionality
- Maintains compatibility with mock audio data

✅ **React Benefits**
- Component-based architecture
- TypeScript type safety
- State management with hooks
- Reactive UI updates

## Implementation Steps

1. **Setup**: Create React app and copy audio engine assets
2. **Services**: Implement AudioEngineService wrapper
3. **Hooks**: Create useAudioEngine and usePlayerController
4. **Components**: Build UI components that mirror HTML functionality
5. **Integration**: Connect everything with proper state management
6. **Testing**: Verify all features work identically to original

This approach gives you a React app with **identical functionality** to your `audio-engine-test` while leveraging React's component architecture and maintaining seamless integration with your existing audio engine. 