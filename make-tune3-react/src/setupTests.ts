// src/setupTests.ts
import '@testing-library/jest-dom';

// Declare global types
declare global {
  var firebaseApp: any;
  var firebaseDb: any;
  var firebaseStorage: any;
}

// Mock HTML Audio Element
Object.defineProperty(window, 'HTMLAudioElement', {
  writable: true,
  value: class MockHTMLAudioElement {
    src = '';
    currentTime = 0;
    duration = 0;
    volume = 1;
    paused = true;
    
    play = () => Promise.resolve();
    pause = () => {};
    load = () => {};
    addEventListener = () => {};
    removeEventListener = () => {};
  }
});

Object.defineProperty(window, 'AudioContext', {
  writable: true,
  value: class MockAudioContext {
    destination = {};
    state = 'running';
    
    createGain = () => ({ 
      connect: () => {}, 
      disconnect: () => {},
      gain: { value: 1 } 
    });
    
    createMediaElementSource = () => ({ 
      connect: () => {},
      disconnect: () => {}
    });
    
    createBiquadFilter = () => ({ 
      connect: () => {},
      disconnect: () => {},
      type: 'peaking',
      frequency: { value: 0 },
      Q: { value: 0 },
      gain: { value: 0 }
    });
    
    createAnalyser = () => ({
      connect: () => {},
      disconnect: () => {},
      fftSize: 2048,
      smoothingTimeConstant: 0.8,
      getByteFrequencyData: () => {},
      getByteTimeDomainData: () => {}
    });
    
    resume = () => Promise.resolve();
  }
});

// Mock webkitAudioContext for Safari
Object.defineProperty(window, 'webkitAudioContext', {
  writable: true,
  value: window.AudioContext
});

// Firebase setup for integration tests
import { initializeApp } from 'firebase/app';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';
import { connectStorageEmulator, getStorage } from 'firebase/storage';

const app = initializeApp({
  projectId: 'demo-test-project',
  apiKey: 'demo-test-api-key',
  authDomain: 'demo-test-project.firebaseapp.com',
  storageBucket: 'demo-test-project.appspot.com',
});

const db = getFirestore(app);
const storage = getStorage(app);

if (process.env.NODE_ENV === 'test') {
  try {
    connectFirestoreEmulator(db, 'localhost', 8080);
    connectStorageEmulator(storage, 'localhost', 9199);
  } catch (e) {
  }
}

globalThis.firebaseApp = app;
globalThis.firebaseDb = db;
globalThis.firebaseStorage = storage;