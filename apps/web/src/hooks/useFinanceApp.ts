import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { storage } from '@/lib/storage';
import { subscribeToPush, unsubscribeFromPush, isPushEnabled, isPushSupported, hasAskedPermission, markAsAsked } from '@/lib/push';
import { applyTheme, getTheme, setTheme } from '@/lib/theme';
import type {
  ApiHealth,
  AppTab,
  AuthUser,
  Category,
  GlobalBalancePayload,
  GroupBalancesPayload,
  GroupExpenseSplitInput,
  GroupSummary,
  Transaction,
  TransactionListFilters,
  TransactionListResponse,
} from '@/types';

const VALID_TABS: AppTab[] = ['home', 'transactions', 'groups', 'profile'];

const generateIdempotencyKey = (): string => {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
};

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

const AUTO_REFRESH_INTERVAL_MS = 10_000;
const EMPTY_BALANCE_SUMMARY: GlobalBalancePayload = {
  personalIncome: 0,
  personalExpense: 0,
  personalBalance: 0,
  groupNet: 0,
  totalBalance: 0,
  groupsBreakdown: [],
};

export const useFinanceApp = () => {
  const [activeTab, setActiveTabState] = useState<AppTab>(getInitialTab);
  const [token, setToken] = useState<string | null>(() => storage.getToken());
  const [user, setUser] = useState<AuthUser | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [selectedGroupData, setSelectedGroupData] = useState<GroupBalancesPayload | null>(null);
  const [selectedGroupJoinCode, setSelectedGroupJoinCode] = useState<string | null>(null);
  const [balanceSummary, setBalanceSummary] = useState<GlobalBalancePayload>(EMPTY_BALANCE_SUMMARY);
  const [health, setHealth] = useState<ApiHealth | null>(null);
  const [booting, setBooting] = useState(Boolean(storage.getToken()));
  const [authBusy, setAuthBusy] = useState(false);
  const [dataBusy, setDataBusy] = useState(false);
  const [groupsBusy, setGroupsBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [transactionError, setTransactionError] = useState<string | null>(null);
  const [groupsError, setGroupsError] = useState<string | null>(null);
  const autoRefreshInFlightRef = useRef(false);

  const [categories, setCategories] = useState<Category[]>([]);
  const [categoriesBusy, setCategoriesBusy] = useState(false);

  const [transactionFilters, setTransactionFilters] = useState<TransactionListFilters>({});
  const [txNextCursor, setTxNextCursor] = useState<string | null>(null);
  const [txHasMore, setTxHasMore] = useState(false);
  const [txLoadingMore, setTxLoadingMore] = useState(false);

  useEffect(() => {
    const onHashChange = () => setActiveTabState(getInitialTab());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  useEffect(() => {
    api.health().then(setHealth).catch(() => setHealth(null));
  }, []);

  // Listen for system theme changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      if (getTheme() === 'system') {
        applyTheme('system');
      }
    };
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  const setActiveTab = useCallback((tab: AppTab) => {
    setActiveTabState(tab);
    setHash(tab);
  }, []);

  const logout = useCallback(() => {
    storage.clearToken();
    setToken(null);
    setUser(null);
    setTransactions([]);
    setGroups([]);
    setSelectedGroupId(null);
    setSelectedGroupData(null);
    setSelectedGroupJoinCode(null);
    setBalanceSummary(EMPTY_BALANCE_SUMMARY);
    setAuthError(null);
    setTransactionError(null);
    setGroupsError(null);
    setActiveTabState('home');
    setHash('home');

    // Reset theme to system on logout
    setTheme('system');
  }, []);

  const refreshBalance = useCallback(async (options?: { silent?: boolean }) => {
    if (!token) return EMPTY_BALANCE_SUMMARY;

    try {
      const nextBalance = await api.balance(token);
      setBalanceSummary(nextBalance);
      return nextBalance;
    } catch {
      if (!options?.silent) {
        setTransactionError('No se pudo actualizar el saldo');
      }
      return EMPTY_BALANCE_SUMMARY;
    }
  }, [token]);

  const refreshGroups = useCallback(async (options?: { silent?: boolean }) => {
    if (!token) return [] as GroupSummary[];

    if (!options?.silent) {
      setGroupsBusy(true);
      setGroupsError(null);
    }

    try {
      const nextGroups = await api.groups(token);
      setGroups(nextGroups);
      setSelectedGroupId(current =>
        current && nextGroups.some((group: GroupSummary) => group.id === current) ? current : (nextGroups[0]?.id ?? null)
      );
      return nextGroups;
    } catch (error) {
      if (!options?.silent) {
        setGroupsError(error instanceof Error ? error.message : 'No se pudieron cargar los grupos');
      }
      return [] as GroupSummary[];
    } finally {
      if (!options?.silent) {
        setGroupsBusy(false);
      }
    }
  }, [token]);

  const refreshSelectedGroup = useCallback(
    async (groupId: string, options?: { silent?: boolean; groupsSource?: GroupSummary[] }) => {
      if (!token) return null;

      if (!options?.silent) {
        setGroupsBusy(true);
        setGroupsError(null);
      }

      try {
        const selectedGroup = (options?.groupsSource || groups).find(group => group.id === groupId);
        const currentMembership = selectedGroup?.members.find(member => member.userId === user?.id);
        const shouldLoadJoinCode = currentMembership?.role === 'admin';

        const [payload, joinCodePayload] = await Promise.all([
          api.groupBalances(token, groupId),
          shouldLoadJoinCode ? api.groupJoinCode(token, groupId).catch(() => null) : Promise.resolve(null),
        ]);

        setSelectedGroupData(payload);
        setSelectedGroupJoinCode(joinCodePayload?.joinCode || null);
        return payload;
      } catch (error) {
        if (!options?.silent) {
          setGroupsError(error instanceof Error ? error.message : 'No se pudo cargar el detalle del grupo');
        }
        setSelectedGroupJoinCode(null);
        return null;
      } finally {
        if (!options?.silent) {
          setGroupsBusy(false);
        }
      }
    },
    [groups, token, user?.id]
  );

  const refreshCategories = useCallback(async (options?: { silent?: boolean }) => {
    if (!token) return [] as Category[];
    if (!options?.silent) {
      setCategoriesBusy(true);
    }
    try {
      const nextCategories = await api.getCategories(token);
      // @ts-ignore
      setCategories(nextCategories.categories || nextCategories || []);
      // @ts-ignore
      return nextCategories.categories || nextCategories || [];
    } catch (error) {
      console.error('Error fetching categories:', error);
      return [] as Category[];
    } finally {
      if (!options?.silent) {
        setCategoriesBusy(false);
      }
    }
  }, [token]);

  const loadSession = useCallback(
    async (sessionToken: string) => {
      setBooting(true);
      setDataBusy(true);
      setGroupsBusy(true);
      setCategoriesBusy(true);

      try {
        // Auth check first — only this one should trigger logout on failure
        const nextUser = await api.me(sessionToken);
        // @ts-ignore
        setUser(nextUser.user || nextUser);

        // Load remaining data in parallel with individual fallbacks
        const results = await Promise.allSettled([
          api.transactions(sessionToken),
          api.groups(sessionToken),
          api.balance(sessionToken),
          api.getCategories(sessionToken).then((res: any) => res.categories || res).catch(() => []),
        ]);

        const [txRes, groupsRes, balanceRes, categoriesRes] = results;

        if (txRes.status === 'fulfilled') {
          setTransactions(txRes.value.transactions);
          setTxNextCursor(txRes.value.nextCursor);
          setTxHasMore(txRes.value.hasMore);
        }

        if (groupsRes.status === 'fulfilled') {
          setGroups(groupsRes.value);
          const firstGroupId = groupsRes.value[0]?.id ?? null;
          setSelectedGroupId(firstGroupId);

          if (firstGroupId) {
            try {
              const firstGroup = groupsRes.value.find((group: GroupSummary) => group.id === firstGroupId);
              // @ts-ignore
              const currentMembership = firstGroup?.members.find((member: { userId: string | null; role: string }) => member.userId === (nextUser.user?.id || nextUser.id));
              const shouldLoadJoinCode = currentMembership?.role === 'admin';
              const [payload, joinCodePayload] = await Promise.all([
                api.groupBalances(sessionToken, firstGroupId),
                shouldLoadJoinCode ? api.groupJoinCode(sessionToken, firstGroupId).catch(() => null) : Promise.resolve(null),
              ]);
              setSelectedGroupData(payload);
              setSelectedGroupJoinCode(joinCodePayload?.joinCode || null);
            } catch {
              setSelectedGroupData(null);
              setSelectedGroupJoinCode(null);
            }
          } else {
            setSelectedGroupData(null);
            setSelectedGroupJoinCode(null);
          }
        } else {
          setGroups([]);
          setSelectedGroupId(null);
          setSelectedGroupData(null);
          setSelectedGroupJoinCode(null);
        }

        if (balanceRes.status === 'fulfilled') {
          setBalanceSummary(balanceRes.value);
        } else {
          setBalanceSummary(EMPTY_BALANCE_SUMMARY);
        }

        if (categoriesRes.status === 'fulfilled') {
          setCategories(categoriesRes.value);
        } else {
          setCategories([]);
        }
      } catch {
        logout();
      } finally {
        setBooting(false);
        setDataBusy(false);
        setGroupsBusy(false);
      }
    },
    [logout]
  );

  useEffect(() => {
    if (!token) {
      setBooting(false);
      return;
    }

    loadSession(token);
  }, [loadSession, token]);

  useEffect(() => {
    if (!selectedGroupId || !token) {
      setSelectedGroupData(null);
      return;
    }

    refreshSelectedGroup(selectedGroupId);
  }, [refreshSelectedGroup, selectedGroupId, token]);

  const refreshTransactions = useCallback(async (options?: { silent?: boolean; filters?: TransactionListFilters }) => {
    if (!token) return;
    if (!options?.silent) setDataBusy(true);

    const filters = options?.filters ?? transactionFilters;

    try {
      const res = await api.transactions(token, filters);
      setTransactions(res.transactions || []);
      setTxNextCursor(res.nextCursor);
      setTxHasMore(res.hasMore);
      setTransactionError(null);
    } catch (error: any) {
      setTransactionError(error.message || 'Error cargando historial');
    } finally {
      if (!options?.silent) setDataBusy(false);
    }
  }, [token, transactionFilters]);

  const applyTransactionFilters = useCallback(async (filters: TransactionListFilters) => {
    setTransactionFilters(filters);
    if (!token) return;
    setDataBusy(true);
    try {
      const res = await api.transactions(token, filters);
      setTransactions(res.transactions || []);
      setTxNextCursor(res.nextCursor);
      setTxHasMore(res.hasMore);
      setTransactionError(null);
    } catch (error: any) {
      setTransactionError(error.message || 'Error aplicando filtros');
    } finally {
      setDataBusy(false);
    }
  }, [token]);

  const loadMoreTransactions = useCallback(async () => {
    if (!token || !txNextCursor || txLoadingMore) return;
    setTxLoadingMore(true);
    try {
      const res = await api.transactions(token, { ...transactionFilters, cursor: txNextCursor });
      setTransactions(prev => {
        const existingIds = new Set(prev.map(tx => tx.id));
        const unique = res.transactions.filter(tx => !existingIds.has(tx.id));
        return [...prev, ...unique];
      });
      setTxNextCursor(res.nextCursor);
      setTxHasMore(res.hasMore);
    } catch (error: any) {
      setTransactionError(error.message || 'Error cargando más movimientos');
    } finally {
      setTxLoadingMore(false);
    }
  }, [token, txNextCursor, txLoadingMore, transactionFilters]);

  const exportTransactionsCsv = useCallback(async () => {
    if (!token) return;
    try {
      const { blob, filename } = await api.exportTransactionsCsv(token, transactionFilters);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error: any) {
      setTransactionError(error.message || 'Error exportando movimientos');
    }
  }, [token, transactionFilters]);

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
          selectedGroupId && nextGroups.some((group: GroupSummary) => group.id === selectedGroupId)
            ? selectedGroupId
            : (nextGroups[0]?.id ?? null);

        if (resolvedGroupId) {
          await Promise.all([
            refreshSelectedGroup(resolvedGroupId, { silent: true, groupsSource: nextGroups }),
            refreshBalance({ silent: true }),
            refreshTransactions({ silent: true }),
          ]);
        } else {
          setSelectedGroupData(null);
          setSelectedGroupJoinCode(null);
          await Promise.all([
            refreshBalance({ silent: true }),
            refreshTransactions({ silent: true }),
          ]);
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
    dataBusy,
    groupsBusy,
    refreshBalance,
    refreshGroups,
    refreshSelectedGroup,
    refreshTransactions,
    selectedGroupId,
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

  const onAuthSuccess = useCallback(
    (response: { token: string; user: AuthUser }) => {
      storage.setToken(response.token);
      setToken(response.token);
      setUser(response.user);
      setAuthError(null);
      setGroupsError(null);
      setActiveTab('home');
      setBalanceSummary(EMPTY_BALANCE_SUMMARY);

      // Apply saved theme for this user
      const savedTheme = getTheme();
      applyTheme(savedTheme);

      // Subscribe to push notifications (non-blocking)
      if (isPushSupported() && isPushEnabled() && !hasAskedPermission()) {
        markAsAsked();
        subscribeToPush(response.token).catch(() => {});
      }
    },
    [setActiveTab]
  );

  const login = useCallback(
    async (input: { email: string; password: string }) => {
      setAuthBusy(true);
      setAuthError(null);

      try {
        const response = await api.login(input);
        onAuthSuccess(response);
      } catch (error) {
        setAuthError(error instanceof Error ? error.message : 'No se pudo iniciar sesión');
      } finally {
        setAuthBusy(false);
      }
    },
    [onAuthSuccess]
  );

  const register = useCallback(
    async (input: { email: string; password: string; name?: string }) => {
      setAuthBusy(true);
      setAuthError(null);

      try {
        const response = await api.register(input);
        onAuthSuccess(response);
      } catch (error) {
        setAuthError(error instanceof Error ? error.message : 'No se pudo crear la cuenta');
      } finally {
        setAuthBusy(false);
      }
    },
    [onAuthSuccess]
  );

  const createTransaction = useCallback(
    async (input: { type: 'income' | 'expense'; amount: number; categoryId?: string; note?: string; occurredAt: string }) => {
      if (!token) return;
      setDataBusy(true);
      setTransactionError(null);
      try {
        const result = await api.createTransaction(token, { ...input, amount: input.amount.toString() } as any);
        // @ts-ignore
        setTransactions(prev => [result.transaction || result, ...prev]);
        await refreshBalance();
      } catch (error: any) {
        setTransactionError(error.message || 'Error guardando transacción');
        throw error;
      } finally {
        setDataBusy(false);
      }
    },
    [token, refreshBalance]
  );

  const updateTransaction = useCallback(
    async (input: { id: string; type?: 'income' | 'expense'; amount?: number; categoryId?: string | null; note?: string | null; occurredAt?: string }) => {
      if (!token) return;
      setDataBusy(true);
      setTransactionError(null);
      try {
        await api.updateTransaction(token, input.id, {
          type: input.type,
          amount: input.amount,
          categoryId: input.categoryId,
          note: input.note,
          occurredAt: input.occurredAt,
        });
        await Promise.all([refreshBalance({ silent: true }), refreshTransactions({ silent: true })]);
      } catch (error: any) {
        setTransactionError(error.message || 'Error actualizando transacción');
        throw error;
      } finally {
        setDataBusy(false);
      }
    },
    [token, refreshBalance, refreshTransactions]
  );

  const deleteTransaction = useCallback(
    async (id: string) => {
      if (!token) return;
      setDataBusy(true);
      setTransactionError(null);
      try {
        await api.deleteTransaction(token, id);
        await Promise.all([refreshBalance({ silent: true }), refreshTransactions({ silent: true })]);
      } catch (error: any) {
        setTransactionError(error.message || 'Error eliminando transacción');
        throw error;
      } finally {
        setDataBusy(false);
      }
    },
    [token, refreshBalance, refreshTransactions]
  );

  const createCategory = useCallback(
    async (input: { name: string; type: 'income' | 'expense'; color?: string; icon?: string }) => {
      if (!token) throw new Error('No auth');
      try {
        const res = await api.createCategory(token, input);
        // @ts-ignore
        const cat = res.category || res;
        setCategories(prev => [...prev, cat].sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name)));
        return cat;
      } catch (error: any) {
        throw new Error(error.message || 'Error creando categoría');
      }
    },
    [token]
  );

  const createGroupCategory = useCallback(
    async (groupId: string, input: { name: string; type: 'income' | 'expense'; color?: string; icon?: string }) => {
      if (!token) throw new Error('No auth');
      try {
        const res = await api.createGroupCategory(token, groupId, input);
        // @ts-ignore
        const cat = res.category || res;
        setCategories(prev => {
          const newCats = [...prev, cat].filter((v, i, a) => a.findIndex(t => t.id === v.id) === i);
          return newCats.sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name));
        });
        return cat;
      } catch (error: any) {
        throw new Error(error.message || 'Error creando categoría de grupo');
      }
    },
    [token]
  );

  const updateGroupCategory = useCallback(
    async (groupId: string, categoryId: string, input: { name?: string; color?: string; icon?: string }) => {
      if (!token) throw new Error('No auth');
      try {
        const res = await api.updateGroupCategory(token, groupId, categoryId, input);
        // @ts-ignore
        const cat = res.category || res;
        setCategories(prev =>
          prev.map(c => c.id === categoryId ? cat : c)
            .sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name))
        );
        return cat;
      } catch (error: any) {
        throw new Error(error.message || 'Error actualizando categoría de grupo');
      }
    },
    [token]
  );

  const deleteGroupCategory = useCallback(
    async (groupId: string, categoryId: string) => {
      if (!token) throw new Error('No auth');
      try {
        await api.deleteGroupCategory(token, groupId, categoryId);
        setCategories(prev => prev.filter(c => c.id !== categoryId));
      } catch (error: any) {
        throw new Error(error.message || 'Error eliminando categoría de grupo');
      }
    },
    [token]
  );

  const updateCategory = useCallback(
    async (categoryId: string, input: { name?: string; color?: string; icon?: string }) => {
      if (!token) throw new Error('No auth');
      try {
        const res = await api.updateCategory(token, categoryId, input);
        // @ts-ignore
        const cat = res.category || res;
        setCategories(prev =>
          prev.map(c => c.id === categoryId ? cat : c)
            .sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name))
        );
        return cat;
      } catch (error: any) {
        throw new Error(error.message || 'Error actualizando categoría');
      }
    },
    [token]
  );

  const deleteCategory = useCallback(
    async (categoryId: string) => {
      if (!token) throw new Error('No auth');
      try {
        await api.deleteCategory(token, categoryId);
        setCategories(prev => prev.filter(c => c.id !== categoryId));
      } catch (error: any) {
        throw new Error(error.message || 'Error eliminando categoría');
      }
    },
    [token]
  );

  const createGroup = useCallback(
    async (input: { name: string; guestMembers: string[] }) => {
      if (!token) return;

      setGroupsBusy(true);
      setGroupsError(null);

      try {
        const res = await api.createGroup(token, {
          name: input.name,
          members: input.guestMembers
            .filter(Boolean)
            .map(displayName => ({ displayName, weight: 1, role: 'member' as const })),
        });
        // @ts-ignore
        const createdGroup = res.group || res;

        await refreshGroups();
        setSelectedGroupId(createdGroup.id);
        setActiveTab('groups');

        await Promise.all([refreshSelectedGroup(createdGroup.id), refreshBalance()]);
      } catch (error) {
        setGroupsError(error instanceof Error ? error.message : 'No se pudo crear el grupo');
      } finally {
        setGroupsBusy(false);
      }
    },
    [refreshBalance, refreshGroups, refreshSelectedGroup, setActiveTab, token]
  );

  const addGroupExpense = useCallback(
    async (
      input: {
        groupId: string;
        description: string;
        amount: number;
        payerMemberId: string;
        categoryId?: string;
        splitMethod: 'equal' | 'manual' | 'weights';
        splits?: GroupExpenseSplitInput[];
        occurredAt: string;
      }
    ) => {
      if (!token) return;

      setGroupsBusy(true);
      setGroupsError(null);

      const idempotencyKey = generateIdempotencyKey();

      try {
        const { groupId, ...rest } = input;
        await api.createGroupExpense(token, groupId, { ...rest, idempotencyKey } as any);
        await Promise.all([
          refreshSelectedGroup(groupId, { silent: true }),
          refreshBalance({ silent: true }),
          refreshTransactions({ silent: true, all: true }),
        ]);
      } catch (error) {
        setGroupsError(error instanceof Error ? error.message : 'No se pudo crear el gasto');
        throw error;
      } finally {
        setGroupsBusy(false);
      }
    },
    [token, refreshSelectedGroup, refreshBalance, refreshTransactions]
  );

  const updateGroupExpense = useCallback(
    async (
      input: {
        expenseId: string;
        groupId: string;
        description: string;
        amount: number;
        payerMemberId: string;
        categoryId?: string;
        splitMethod: 'equal' | 'manual' | 'weights';
        splits?: GroupExpenseSplitInput[];
        occurredAt: string;
      }
    ) => {
      if (!token) return;

      setGroupsBusy(true);
      setGroupsError(null);

      try {
        const { groupId, expenseId, ...rest } = input;
        await api.updateGroupExpense(token, groupId, expenseId, rest);
        await Promise.all([
          refreshSelectedGroup(groupId, { silent: true }),
          refreshBalance({ silent: true }),
          refreshTransactions({ silent: true, all: true }),
        ]);
      } catch (error) {
        setGroupsError(error instanceof Error ? error.message : 'No se pudo actualizar el gasto');
        throw error;
      } finally {
        setGroupsBusy(false);
      }
    },
    [token, refreshSelectedGroup, refreshBalance, refreshTransactions]
  );

  const addGroupMember = useCallback(
    async (input: { groupId: string; displayName: string }) => {
      if (!token) return;

      setGroupsBusy(true);
      setGroupsError(null);

      try {
        await api.createGroupMember(token, input.groupId, {
          displayName: input.displayName,
          weight: 1,
        });

        await Promise.all([refreshGroups(), refreshSelectedGroup(input.groupId)]);
      } catch (error) {
        setGroupsError(error instanceof Error ? error.message : 'No se pudo añadir el miembro');
      } finally {
        setGroupsBusy(false);
      }
    },
    [refreshGroups, refreshSelectedGroup, token]
  );

  const deleteGroupMember = useCallback(
    async (groupId: string, memberId: string) => {
      if (!token) return;

      setGroupsBusy(true);
      setGroupsError(null);

      try {
        await api.deleteGroupMember(token, groupId, memberId);
        await Promise.all([refreshGroups(), refreshSelectedGroup(groupId)]);
      } catch (error) {
        setGroupsError(error instanceof Error ? error.message : 'No se pudo eliminar el miembro');
      } finally {
        setGroupsBusy(false);
      }
    },
    [refreshGroups, refreshSelectedGroup, token]
  );

  const joinGroupByCode = useCallback(
    async (code: string) => {
      if (!token) return;

      setGroupsBusy(true);
      setGroupsError(null);

      try {
        const res = await api.joinGroupByCode(token, code.trim().toUpperCase());
        // @ts-ignore
        const joinedGroup = res.group || res;
        await Promise.all([refreshGroups(), refreshBalance()]);
        setSelectedGroupId(joinedGroup.id);
        await refreshSelectedGroup(joinedGroup.id);
        setActiveTab('groups');
      } catch (error) {
        setGroupsError(error instanceof Error ? error.message : 'No se pudo unir al grupo');
      } finally {
        setGroupsBusy(false);
      }
    },
    [refreshBalance, refreshGroups, refreshSelectedGroup, setActiveTab, token]
  );

  const createSettlement = useCallback(
    async (input: { groupId: string; fromMemberId: string; toMemberId: string; amount: number }) => {
      if (!token) return;

      setGroupsBusy(true);
      setGroupsError(null);

      const idempotencyKey = generateIdempotencyKey();

      try {
        await api.createSettlement(token, input.groupId, {
          fromMemberId: input.fromMemberId,
          toMemberId: input.toMemberId,
          amount: input.amount,
          occurredAt: new Date().toISOString(),
          idempotencyKey,
        });

        await Promise.all([
          refreshSelectedGroup(input.groupId),
          refreshBalance(),
          refreshTransactions({ silent: true }),
        ]);
      } catch (error) {
        setGroupsError(error instanceof Error ? error.message : 'No se pudo crear la liquidación');
      } finally {
        setGroupsBusy(false);
      }
    },
    [refreshBalance, refreshSelectedGroup, token]
  );

  const confirmSettlement = useCallback(
    async (groupId: string, settlementId: string) => {
      if (!token) return;

      setGroupsBusy(true);
      setGroupsError(null);

      try {
        await api.updateSettlementStatus(token, groupId, settlementId, 'confirmed');
        await Promise.all([
          refreshSelectedGroup(groupId),
          refreshBalance(),
          refreshTransactions({ silent: true }),
        ]);
      } catch (error) {
        setGroupsError(error instanceof Error ? error.message : 'No se pudo confirmar la liquidación');
      } finally {
        setGroupsBusy(false);
      }
    },
    [refreshBalance, refreshSelectedGroup, token]
  );

  const dashboardSummary = useMemo(() => {
    return {
      income: balanceSummary.personalIncome,
      expense: balanceSummary.personalExpense,
      balance: balanceSummary.personalBalance,
      groupNet: balanceSummary.groupNet,
      total: balanceSummary.totalBalance,
    };
  }, [balanceSummary]);

  return {
    activeTab,
    addGroupExpense,
    addGroupMember,
    applyTransactionFilters,
    authBusy,
    authError,
    booting,
    categories,
    categoriesBusy,
    confirmSettlement,
    createCategory,
    createGroup,
    createGroupCategory,
    createSettlement,
    createTransaction,
    dashboardSummary,
    dataBusy,
    deleteCategory,
    deleteGroupCategory,
    deleteGroupMember,
    deleteTransaction,
    updateTransaction,
    exportTransactionsCsv,
    groups,
    groupsBusy,
    groupsError,
    health,
    isAuthenticated: Boolean(user && token),
    isPushEnabled: isPushEnabled(),
    isPushSupported: isPushSupported(),
    subscribeToPush: (t: string) => subscribeToPush(t),
    unsubscribeFromPush: (t: string) => unsubscribeFromPush(t),
    theme: getTheme(),
    setTheme: (t: 'light' | 'dark' | 'system') => setTheme(t),
    joinGroupByCode,
    loadMoreTransactions,
    login,
    logout,
    refreshBalance,
    refreshCategories,
    refreshGroups,
    refreshSelectedGroup,
    refreshTransactions,
    register,
    selectedGroupData,
    selectedGroupId,
    selectedGroupJoinCode,
    setActiveTab,
    setSelectedGroupId,
    transactionError,
    transactionFilters,
    transactions,
    txHasMore,
    txLoadingMore,
    updateCategory,
    updateGroupCategory,
    updateGroupExpense,
    user,
  };
};
