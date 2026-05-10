import { useCallback, useEffect, useState } from 'react';
import type { AppTab } from '@/types';

const VALID_TABS: AppTab[] = ['home', 'transactions', 'groups', 'profile'];

const getInitialTab = (): AppTab => {
  const hash = window.location.hash.replace('#', '') as AppTab;
  return VALID_TABS.includes(hash) ? hash : 'home';
};

const setHash = (tab: AppTab) => {
  const next = `#${tab}`;
  if (window.location.hash !== next) {
    window.location.hash = next;
  }
};

export const useNavigation = () => {
  const [activeTab, setActiveTabState] = useState<AppTab>(getInitialTab);

  useEffect(() => {
    const onHashChange = () => setActiveTabState(getInitialTab());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const setActiveTab = useCallback((tab: AppTab) => {
    setActiveTabState(tab);
    setHash(tab);
  }, []);

  const resetToHome = useCallback(() => {
    setActiveTabState('home');
    setHash('home');
  }, []);

  return { activeTab, setActiveTab, resetToHome };
};
