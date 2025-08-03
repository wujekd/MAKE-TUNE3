import '@testing-library/jest-dom';

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

// Mock Web Audio API
Object.defineProperty(window, 'AudioContext', {
  writable: true,
  value: class MockAudioContext {
    destination = {};
    
    createGain = () => ({
      connect: () => {},
      gain: { value: 1 }
    });
    
    createMediaElementSource = () => ({
      connect: () => {}
    });
  }
});

// Mock webkitAudioContext for Safari
Object.defineProperty(window, 'webkitAudioContext', {
  writable: true,
  value: window.AudioContext
}); 