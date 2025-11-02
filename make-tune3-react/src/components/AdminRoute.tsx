import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../stores/appStore';

export function AdminRoute({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const { user, loading } = useAppStore(s => s.auth);

  useEffect(() => {
    if (loading) return;
    
    if (!user) {
      navigate('/auth', { replace: true });
      return;
    }
    
    if (!user.isAdmin) {
      navigate('/access-denied', { replace: true });
      return;
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        color: 'var(--white)'
      }}>
        Loading...
      </div>
    );
  }

  if (!user || !user.isAdmin) {
    return null;
  }

  return <>{children}</>;
}

