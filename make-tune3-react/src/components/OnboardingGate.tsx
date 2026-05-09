import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAppStore } from '../stores/appStore';
import { LoadingSpinner } from './LoadingSpinner';
import { needsUsernameOnboarding } from '../utils/onboarding';

function GateLoadingFallback() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '32px 16px' }}>
      <LoadingSpinner size={24} />
    </div>
  );
}

export function OnboardingGate() {
  const location = useLocation();
  const user = useAppStore(state => state.auth.user);
  const loading = useAppStore(state => state.auth.loading);

  if (loading) {
    return <GateLoadingFallback />;
  }

  if (needsUsernameOnboarding(user)) {
    const returnTo = `${location.pathname}${location.search}${location.hash}`;
    return (
      <Navigate
        to={`/onboarding/username?returnTo=${encodeURIComponent(returnTo)}`}
        replace
      />
    );
  }

  return <Outlet />;
}
