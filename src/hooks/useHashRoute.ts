import { useCallback, useEffect, useState } from 'react';
import type { ModuleKey } from '../types/cet4';

const VALID_ROUTES: ModuleKey[] = [
  'dashboard',
  'vocab',
  'writing',
  'translation',
  'reading',
  'listening',
  'mock',
  'settings',
];

function parseHash(): ModuleKey {
  const raw = window.location.hash.replace(/^#\/?/, '').split('?')[0].trim();
  if (!raw) return 'dashboard';
  return VALID_ROUTES.includes(raw as ModuleKey) ? (raw as ModuleKey) : 'dashboard';
}

export function useHashRoute() {
  const [route, setRoute] = useState<ModuleKey>(() => parseHash());

  useEffect(() => {
    const handleHashChange = () => setRoute(parseHash());
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const navigate = useCallback((next: ModuleKey) => {
    const targetHash = next === 'dashboard' ? '#/' : `#/${next}`;
    if (window.location.hash !== targetHash) {
      window.location.hash = targetHash;
    } else {
      setRoute(next);
    }
  }, []);

  return { route, navigate };
}
