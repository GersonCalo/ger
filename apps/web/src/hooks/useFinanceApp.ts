import { useCallback } from 'react';
import { getTheme, setTheme } from '@/lib/theme';
import { isPushEnabled, isPushSupported, subscribeToPush, unsubscribeFromPush } from '@/lib/push';
import { useAuth } from '@/hooks/useAuth';
import { useAutoRefresh } from '@/hooks/useAutoRefresh';
import { useBootstrap } from '@/hooks/useBootstrap';
import { useCategories } from '@/hooks/useCategories';
import { useGroups } from '@/hooks/useGroups';
import { useNavigation } from '@/hooks/useNavigation';
import { useTransactions } from '@/hooks/useTransactions';

const useFinanceAppImpl = () => {
  const navigation = useNavigation();
  const auth = useAuth();
  const transactions = useTransactions({ token: auth.token });
  const categories = useCategories({ token: auth.token });
  const groups = useGroups({ token: auth.token, user: auth.user, setActiveTab: navigation.setActiveTab, refreshBalance: transactions.refreshBalance, refreshTransactions: transactions.refreshTransactions });
  useBootstrap({ token: auth.token, setBooting: auth.setBooting, loadSession: auth.loadSession, logoutBase: auth.logoutBase, resetToHome: navigation.resetToHome, hydrateTransactions: transactions.hydrate, resetTransactions: transactions.reset, hydrateGroups: groups.hydrate, refreshSelectedGroup: groups.refreshSelectedGroup, clearSelectedGroup: groups.clearSelectedGroup, resetGroups: groups.reset, hydrateCategories: categories.hydrate, resetCategories: categories.reset });

  const logout = useCallback(() => {
    auth.logoutBase();
    transactions.reset();
    groups.reset();
    categories.reset();
    navigation.resetToHome();
  }, [auth, categories, groups, navigation, transactions]);

  useAutoRefresh({
    token: auth.token,
    activeTab: navigation.activeTab,
    booting: auth.booting,
    authBusy: auth.authBusy,
    dataBusy: transactions.dataBusy,
    groupsBusy: groups.groupsBusy,
    selectedGroupId: groups.selectedGroupId,
    refreshGroups: groups.refreshGroups,
    refreshSelectedGroup: groups.refreshSelectedGroup,
    refreshBalance: transactions.refreshBalance,
    refreshTransactions: transactions.refreshTransactions,
    setSelectedGroupId: groups.setSelectedGroupId,
    clearSelectedGroupData: groups.clearSelectedGroup,
  });

  const pushThemePublic = {
    isPushEnabled: isPushEnabled(),
    isPushSupported: isPushSupported(),
    subscribeToPush: (t: string) => subscribeToPush(t),
    unsubscribeFromPush: (t: string) => unsubscribeFromPush(t),
    theme: getTheme(),
    setTheme: (t: 'light' | 'dark' | 'system') => setTheme(t),
  };

  return { activeTab: navigation.activeTab, setActiveTab: navigation.setActiveTab, ...auth, ...transactions, ...groups, ...categories, ...pushThemePublic, logout };
};

export type UseFinanceAppReturn = ReturnType<typeof useFinanceAppImpl>;

export const useFinanceApp = useFinanceAppImpl;
