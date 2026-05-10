import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { AppTab } from '@/types';

const pathToTab = (pathname: string): AppTab => {
  if (pathname === '/' || pathname === '') return 'home';
  if (pathname === '/transactions') return 'transactions';
  if (pathname.startsWith('/groups')) return 'groups';
  if (pathname === '/profile') return 'profile';
  return 'home';
};

const tabToPath = (tab: AppTab): string => {
  switch (tab) {
    case 'home': return '/';
    case 'transactions': return '/transactions';
    case 'groups': return '/groups';
    case 'profile': return '/profile';
  }
};

export const useNavigation = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const activeTab = pathToTab(location.pathname);

  const setActiveTab = useCallback((tab: AppTab) => {
    navigate(tabToPath(tab));
  }, [navigate]);

  const resetToHome = useCallback(() => {
    navigate('/', { replace: true });
  }, [navigate]);

  return { activeTab, setActiveTab, resetToHome };
};
