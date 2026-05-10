import { useEffect } from 'react';
import { api } from '@/lib/api';
import type { AuthUser } from '@/types';

type UseBootstrapParams = {
  token: string | null;
  setBooting: (v: boolean) => void;
  loadSession: (token: string) => Promise<AuthUser>;
  logoutBase: () => void;
  resetToHome: () => void;
  hydrateTransactions: (payload: { transactions: any[]; nextCursor: string | null; hasMore: boolean; balance: any }) => void;
  resetTransactions: () => void;
  hydrateGroups: (next: any[]) => void;
  refreshSelectedGroup: (groupId: string, options?: { silent?: boolean; groupsSource?: any[] }) => Promise<any>;
  clearSelectedGroup: () => void;
  resetGroups: () => void;
  hydrateCategories: (next: any[]) => void;
  resetCategories: () => void;
};

export const useBootstrap = ({
  token,
  setBooting,
  loadSession,
  logoutBase,
  resetToHome,
  hydrateTransactions,
  resetTransactions,
  hydrateGroups,
  refreshSelectedGroup,
  clearSelectedGroup,
  resetGroups,
  hydrateCategories,
  resetCategories,
}: UseBootstrapParams) => {
  useEffect(() => {
    if (!token) return;

    let cancelled = false;
    setBooting(true);

    (async () => {
      try {
        const sessionToken = token;
        await loadSession(sessionToken);

        const results = await Promise.allSettled([
          api.transactions(sessionToken),
          api.groups(sessionToken),
          api.balance(sessionToken),
          api.getCategories(sessionToken),
        ]);

        if (cancelled) return;

        const [txRes, groupsRes, balanceRes, categoriesRes] = results;
        if (txRes.status === 'fulfilled' && balanceRes.status === 'fulfilled') {
          hydrateTransactions({
            transactions: txRes.value.transactions,
            nextCursor: txRes.value.nextCursor,
            hasMore: txRes.value.hasMore,
            balance: balanceRes.value,
          });
        }

        if (groupsRes.status === 'fulfilled') {
          hydrateGroups(groupsRes.value);
          const firstGroupId = groupsRes.value[0]?.id ?? null;
          if (firstGroupId) {
            await refreshSelectedGroup(firstGroupId, { silent: true, groupsSource: groupsRes.value });
          } else {
            clearSelectedGroup();
          }
        } else {
          resetGroups();
        }

        if (categoriesRes.status === 'fulfilled') {
          hydrateCategories(categoriesRes.value);
        } else {
          resetCategories();
        }
      } catch {
        logoutBase();
        resetTransactions();
        resetGroups();
        resetCategories();
        resetToHome();
      } finally {
        if (!cancelled) setBooting(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    clearSelectedGroup,
    hydrateCategories,
    hydrateGroups,
    hydrateTransactions,
    loadSession,
    logoutBase,
    refreshSelectedGroup,
    resetCategories,
    resetGroups,
    resetToHome,
    resetTransactions,
    setBooting,
    token,
  ]);
};
