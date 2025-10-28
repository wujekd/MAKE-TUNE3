import React from 'react';
import './Auth.css';

interface ForgotPasswordProps {
  onBackToSignIn?: () => void;
}

export function ForgotPassword({ onBackToSignIn }: ForgotPasswordProps) {
  return (
    <div className="auth-form">
      <h2>Forgot Password</h2>
      <div className="form-group" style={{ textAlign: 'center' }}>
        Omg you forgot? Think harder.
      </div>
      {onBackToSignIn && (
        <div className="auth-links">
          <button type="button" onClick={onBackToSignIn}>Back to Sign In</button>
        </div>
      )}
    </div>
  );
}