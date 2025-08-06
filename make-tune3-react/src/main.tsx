import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AudioEngineProvider } from './audio-services/AudioEngineContext';
import { AuthProvider } from './contexts/AuthContext';
import { UserDataProvider } from './contexts/UserDataContext';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  // <React.StrictMode>
    <AuthProvider>
      <UserDataProvider>
        <AudioEngineProvider>
          <App />
        </AudioEngineProvider>
      </UserDataProvider>
    </AuthProvider>
  // </React.StrictMode>
);