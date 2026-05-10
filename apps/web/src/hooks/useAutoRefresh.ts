import { useCallback, useEffect, useRef } from 'react';
import type { AppTab, GroupSummary } from '@/types';

const AUTO_REFRESH_INTERVAL_MS = 10_000;

type UseAutoRefreshParams = {
  token: string | null;
  activeTab: AppTab;
  booting: boolean;
  authBusy: boolean;
  dataBusy: boolean;
  groupsBusy: boolean;
  selectedGroupId: string | null;
  refreshGroups: (options?: { silent?: boolean }) => Promise<GroupSummary[]>;
  refreshSelectedGroup: (groupId: string, options?: { silent?: boolean; groupsSource?: GroupSummary[] }) => Promise<any>;
  refreshBalance: (options?: { silent?: boolean }) => Promise<any>;
  refreshTransactions: (options?: { silent?: boolean }) => Promise<void>;
  setSelectedGroupId: (id: string | null) => void;
  clearSelectedGroupData: () => void;
};

export const useAutoRefresh = ({
  token,
  activeTab,
  booting,
  authBusy,
  dataBusy,
  groupsBusy,
  selectedGroupId,
  refreshGroups,
  refreshSelectedGroup,
  refreshBalance,
  refreshTransactions,
  setSelectedGroupId,
  clearSelectedGroupData,
}: UseAutoRefreshParams) => {
  const autoRefreshInFlightRef = useRef(false);

  const runAutomaticRefresh = useCallback(async () => {
    if (!token || booting || authBusy || dataBusy || groupsBusy) return;
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
    if (activeTab !== 'groups' && activeTab !== 'home') return;
    if (autoRefreshInFlightRef.current) return;

    autoRefreshInFlightRef.current = true;

    try {
      if (activeTab === 'groups') {
        const nextGroups = await refreshGroups({ silent: true });
        const resolvedGroupId =
          selectedGroupId && nextGroups.some(group => group.id === selectedGroupId)
            ? selectedGroupId
            : (nextGroups[0]?.id ?? null);

        if (resolvedGroupId) {
          setSelectedGroupId(resolvedGroupId);
          await Promise.all([
            refreshSelectedGroup(resolvedGroupId, { silent: true, groupsSource: nextGroups }),
            refreshBalance({ silent: true }),
            refreshTransactions({ silent: true }),
          ]);
        } else {
          setSelectedGroupId(null);
          clearSelectedGroupData();
          await Promise.all([refreshBalance({ silent: true }), refreshTransactions({ silent: true })]);
        }

        return;
      }

      await Promise.all([refreshGroups({ silent: true }), refreshBalance({ silent: true }), refreshTransactions({ silent: true })]);
    } finally {
      autoRefreshInFlightRef.current = false;
    }
  }, [
    activeTab,
    authBusy,
    booting,
    clearSelectedGroupData,
    dataBusy,
    groupsBusy,
    refreshBalance,
    refreshGroups,
    refreshSelectedGroup,
    refreshTransactions,
    selectedGroupId,
    setSelectedGroupId,
    token,
  ]);

  useEffect(() => {
    if (!token) return;
    if (activeTab !== 'groups' && activeTab !== 'home') return;

    const intervalId = window.setInterval(() => {
      void runAutomaticRefresh();
    }, AUTO_REFRESH_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [activeTab, runAutomaticRefresh, token]);

  useEffect(() => {
    if (!token) return;
    if (activeTab !== 'groups' && activeTab !== 'home') return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void runAutomaticRefresh();
      }
    };

    const handleFocus = () => {
      void runAutomaticRefresh();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [activeTab, runAutomaticRefresh, token]);
};
