import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../stores/appStore';
import { PageLoadingFallback } from './PageLoadingFallback';

export function AdminRoute({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const user = useAppStore(s => s.auth.user);
  const loading = useAppStore(s => s.auth.loading);

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
    return <PageLoadingFallback />;
  }

  if (!user || !user.isAdmin) {
    return null;
  }

  return <>{children}</>;
}
