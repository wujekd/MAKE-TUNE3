import React, { useEffect } from 'react';
import { useAppStore } from '../stores/appStore';

export function AuthInitializer({ children }: { children: React.ReactNode }) {
  const { initializeAuth } = useAppStore(state => state.auth);

  useEffect(() => {
    const unsubscribe = initializeAuth();
    
    // Cleanup on unmount
    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, [initializeAuth]);

  return <>{children}</>;
} 