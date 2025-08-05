import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AudioEngineProvider } from './audio-services/AudioEngineContext';
import { AuthProvider } from './contexts/AuthContext';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  // <React.StrictMode>
    <AuthProvider>
      <AudioEngineProvider>
        <App />
      </AudioEngineProvider>
    </AuthProvider>
  // </React.StrictMode>
);