import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getActiveTab, getSectionByPathname } from '@/lib/navigation';
import type { AppTab } from '@/types';

export const useNavigation = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const activeTab = getActiveTab(location.pathname);

  const setActiveTab = useCallback((tab: AppTab) => {
    const section = getSectionByPathname(location.pathname);
    const tabToPath: Record<AppTab, string> = {
      home: '/',
      transactions: '/transactions',
      groups: '/groups',
      profile: '/profile',
    };
    navigate(tabToPath[tab]);
  }, [navigate, location.pathname]);

  const resetToHome = useCallback(() => {
    navigate('/', { replace: true });
  }, [navigate]);

  return { activeTab, setActiveTab, resetToHome };
};
