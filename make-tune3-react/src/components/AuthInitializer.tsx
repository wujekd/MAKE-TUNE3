import React, { useEffect } from 'react';
import { useAppStore } from '../stores/appStore';

export function AuthInitializer({ children }: { children: React.ReactNode }) {
  const { initializeAuth } = useAppStore();

  useEffect(() => {
    const unsubscribe = initializeAuth();
    
    // Cleanup on unmount
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [initializeAuth]);

  return <>{children}</>;
} 