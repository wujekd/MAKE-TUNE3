import { useEffect, useState } from 'react';

const QUERY = '(max-width: 640px) and (orientation: portrait)';

export function useIsPhonePortrait(): boolean {
  const getInitial = () => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return false;
    }
    return window.matchMedia(QUERY).matches;
  };

  const [isMatch, setIsMatch] = useState<boolean>(getInitial);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }
    const mql = window.matchMedia(QUERY);
    const handleChange = (event: MediaQueryListEvent) => {
      setIsMatch(event.matches);
    };
    setIsMatch(mql.matches);
    mql.addEventListener('change', handleChange);
    return () => {
      mql.removeEventListener('change', handleChange);
    };
  }, []);

  return isMatch;
}

