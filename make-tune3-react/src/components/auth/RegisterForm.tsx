import React, { useState } from 'react';
import { useAppStore } from '../../stores/appStore';
import './Auth.css';

interface RegisterFormProps {
  onSwitchToSignIn: () => void;
}

export function RegisterForm({ onSwitchToSignIn }: RegisterFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const { signUp } = useAppStore(state => state.auth);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      await signUp(email, password);
    } catch (error: any) {
      setError(error.message || 'Failed to create account');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-form">
      <h2>Sign Up</h2>
      {error && <div className="error-message">{error}</div>}
      
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="email">Email</label>
          <input
            type="email"
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="password">Password</label>
          <input
            type="password"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="confirmPassword">Confirm Password</label>
          <input
            type="password"
            id="confirmPassword"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />
        </div>
        
        <button type="submit" disabled={loading}>
          {loading ? 'Creating Account...' : 'Sign Up'}
        </button>
      </form>
      
      <div className="auth-links">
        <button type="button" onClick={onSwitchToSignIn}>
          Already have an account? Sign In
        </button>
      </div>
    </div>
  );
} 