import React, { useState } from 'react';
import { LoginForm } from '../../components/auth/LoginForm';
import { RegisterForm } from '../../components/auth/RegisterForm';
import { ForgotPassword } from '../../components/auth/ForgotPassword';
import { useAppStore } from '../../stores/appStore';
import type { AuthMode } from '../../types/auth';

interface AuthViewProps {
  onBackToMain: () => void;
  initialMode?: AuthMode;
}

export function AuthView({ onBackToMain, initialMode = 'login' }: AuthViewProps) {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const { user } = useAppStore(state => state.auth);

  if (user) {
    return null;
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <button 
            type="button" 
            className="back-button"
            onClick={onBackToMain}
          >
            ← Back to Main
          </button>
          <h1>Make Tune 3</h1>
        </div>
        
        {mode === 'login' ? (
          <LoginForm 
            onSwitchToSignUp={() => setMode('register')}
            onSwitchToForgotPassword={() => setMode('forgotPassword')}
          />
        ) : mode === 'register' ? (
          <RegisterForm 
            onSwitchToSignIn={() => setMode('login')}
          />
        ) : (
          <ForgotPassword onBackToSignIn={() => setMode('login')} />
        )}
      </div>
    </div>
  );
}  