import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AudioEngineProvider } from './audio-services/AudioEngineContext';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  // <React.StrictMode>
    <AudioEngineProvider>
      <App />
    </AudioEngineProvider>
  // </React.StrictMode>
);