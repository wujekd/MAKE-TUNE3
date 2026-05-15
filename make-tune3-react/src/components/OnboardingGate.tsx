import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAppStore } from '../stores/appStore';
import { needsUsernameOnboarding } from '../utils/onboarding';
import { PageLoadingFallback } from './PageLoadingFallback';

export function OnboardingGate() {
  const location = useLocation();
  const user = useAppStore(state => state.auth.user);
  const loading = useAppStore(state => state.auth.loading);

  if (loading) {
    return <PageLoadingFallback />;
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
