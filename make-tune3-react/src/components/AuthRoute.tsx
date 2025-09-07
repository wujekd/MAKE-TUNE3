import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AuthView } from '../views/auth/AuthView';
import { useAppStore } from '../stores/appStore';

export function AuthRoute() {
  const navigate = useNavigate();
  const setShowAuth = useAppStore(s => s.ui.setShowAuth);
  const user = useAppStore(s => s.auth.user);
  const [sp] = useSearchParams();
  const initialMode = sp.get('mode') === 'register' ? 'register' : 'login';

  useEffect(() => {
    if (user) {
      if (!user.username) navigate('/onboarding/username', { replace: true });
      else navigate('/collabs', { replace: true });
    }
  }, [user, navigate]);
  return <AuthView initialMode={initialMode as any} onBackToMain={() => { setShowAuth(false); navigate('/collabs'); }} />
}

