import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../stores/appStore';
import { AuthService } from '../services/authService';
import '../components/auth/Auth.css';

export function UsernameOnboarding() {
  const navigate = useNavigate();
  const user = useAppStore(s => s.auth.user);
  const [username, setUsername] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!user) {
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await AuthService.claimUsername(user.uid, username);
      const refreshed = await AuthService.getUserProfile(user.uid);
      useAppStore.setState(state => ({ auth: { ...state.auth, user: refreshed } }));
      navigate('/collabs', { replace: true });
    } catch (e: any) {
      setError(e?.message || 'Failed to set username');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <h1>Choose Username</h1>
        </div>
        <div className="auth-form">
          {error && <div className="error-message">{error}</div>}
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="username">Username</label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="a-z, 0-9, _ (3-20 chars)"
                required
              />
            </div>
            <button type="submit" disabled={loading}>
              {loading ? 'Saving...' : 'Save username'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}


