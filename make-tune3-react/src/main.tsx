import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AudioEngineProvider } from './audio-services/AudioEngineContext';
import { AuthInitializer } from './components/AuthInitializer';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  // <React.StrictMode>
    <AuthInitializer>
      <AudioEngineProvider>
        <App />
      </AudioEngineProvider>
    </AuthInitializer>
  // </React.StrictMode>
);