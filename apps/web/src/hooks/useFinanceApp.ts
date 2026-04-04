import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { storage } from '@/lib/storage';
import type { ApiHealth, AppTab, AuthUser, GroupBalancesPayload, GroupSummary, Transaction } from '@/types';

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

const GROUPS_NOTICE = 'Tus grupos ya se guardan en la base de datos y se sincronizan con la API.';

export const useFinanceApp = () => {
  const [activeTab, setActiveTabState] = useState<AppTab>(getInitialTab);
  const [token, setToken] = useState<string | null>(() => storage.getToken());
  const [user, setUser] = useState<AuthUser | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [selectedGroupData, setSelectedGroupData] = useState<GroupBalancesPayload | null>(null);
  const [health, setHealth] = useState<ApiHealth | null>(null);
  const [booting, setBooting] = useState(Boolean(storage.getToken()));
  const [authBusy, setAuthBusy] = useState(false);
  const [dataBusy, setDataBusy] = useState(false);
  const [groupsBusy, setGroupsBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [transactionError, setTransactionError] = useState<string | null>(null);
  const [groupsError, setGroupsError] = useState<string | null>(null);

  useEffect(() => {
    const onHashChange = () => setActiveTabState(getInitialTab());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  useEffect(() => {
    api.health().then(setHealth).catch(() => setHealth(null));
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
    setAuthError(null);
    setTransactionError(null);
    setGroupsError(null);
    setActiveTabState('home');
    setHash('home');
  }, []);

  const refreshGroups = useCallback(async () => {
    if (!token) return [] as GroupSummary[];

    setGroupsBusy(true);
    setGroupsError(null);

    try {
      const nextGroups = await api.groups(token);
      setGroups(nextGroups);
      setSelectedGroupId(current =>
        current && nextGroups.some(group => group.id === current) ? current : (nextGroups[0]?.id ?? null)
      );
      return nextGroups;
    } catch (error) {
      setGroupsError(error instanceof Error ? error.message : 'No se pudieron cargar los grupos');
      return [] as GroupSummary[];
    } finally {
      setGroupsBusy(false);
    }
  }, [token]);

  const refreshSelectedGroup = useCallback(
    async (groupId: string) => {
      if (!token) return null;

      setGroupsBusy(true);
      setGroupsError(null);

      try {
        const payload = await api.groupBalances(token, groupId);
        setSelectedGroupData(payload);
        return payload;
      } catch (error) {
        setGroupsError(error instanceof Error ? error.message : 'No se pudo cargar el detalle del grupo');
        return null;
      } finally {
        setGroupsBusy(false);
      }
    },
    [token]
  );

  const loadSession = useCallback(
    async (sessionToken: string) => {
      setBooting(true);
      setDataBusy(true);
      setGroupsBusy(true);

      try {
        const [nextUser, nextTransactions, nextGroups] = await Promise.all([
          api.me(sessionToken),
          api.transactions(sessionToken),
          api.groups(sessionToken),
        ]);

        setUser(nextUser);
        setTransactions(nextTransactions);
        setGroups(nextGroups);

        const firstGroupId = nextGroups[0]?.id ?? null;
        setSelectedGroupId(firstGroupId);

        if (firstGroupId) {
          try {
            const payload = await api.groupBalances(sessionToken, firstGroupId);
            setSelectedGroupData(payload);
          } catch {
            setSelectedGroupData(null);
          }
        } else {
          setSelectedGroupData(null);
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

  const onAuthSuccess = useCallback(
    (response: { token: string; user: AuthUser }) => {
      storage.setToken(response.token);
      setToken(response.token);
      setUser(response.user);
      setAuthError(null);
      setGroupsError(null);
      setActiveTab('home');
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

  const refreshTransactions = useCallback(async () => {
    if (!token) return;

    setDataBusy(true);
    setTransactionError(null);

    try {
      const nextTransactions = await api.transactions(token);
      setTransactions(nextTransactions);
    } catch (error) {
      setTransactionError(error instanceof Error ? error.message : 'No se pudieron cargar los movimientos');
    } finally {
      setDataBusy(false);
    }
  }, [token]);

  const createTransaction = useCallback(
    async (input: { type: 'income' | 'expense'; amount: number; category?: string; note?: string }) => {
      if (!token) return;

      setDataBusy(true);
      setTransactionError(null);

      try {
        const transaction = await api.createTransaction(token, {
          ...input,
          occurredAt: new Date().toISOString(),
        });

        setTransactions(current => [transaction, ...current]);
        setActiveTab('transactions');
      } catch (error) {
        setTransactionError(error instanceof Error ? error.message : 'No se pudo guardar el movimiento');
      } finally {
        setDataBusy(false);
      }
    },
    [setActiveTab, token]
  );

  const createGroup = useCallback(
    async (input: { name: string; guestMembers: string[] }) => {
      if (!token) return;

      setGroupsBusy(true);
      setGroupsError(null);

      try {
        const createdGroup = await api.createGroup(token, {
          name: input.name,
          members: input.guestMembers
            .filter(Boolean)
            .map(displayName => ({ displayName, weight: 1, role: 'member' as const })),
        });

        const nextGroups = await api.groups(token);
        setGroups(nextGroups);
        setSelectedGroupId(createdGroup.id);
        setActiveTab('groups');

        const payload = await api.groupBalances(token, createdGroup.id);
        setSelectedGroupData(payload);
      } catch (error) {
        setGroupsError(error instanceof Error ? error.message : 'No se pudo crear el grupo');
      } finally {
        setGroupsBusy(false);
      }
    },
    [setActiveTab, token]
  );

  const addGroupExpense = useCallback(
    async (input: {
      groupId: string;
      description: string;
      amount: number;
      payerMemberId: string;
      splitMethod: 'equal' | 'weights';
    }) => {
      if (!token) return;

      setGroupsBusy(true);
      setGroupsError(null);

      try {
        await api.createGroupExpense(token, input.groupId, {
          payerMemberId: input.payerMemberId,
          amount: input.amount,
          description: input.description,
          occurredAt: new Date().toISOString(),
          splitMethod: input.splitMethod,
        });

        await Promise.all([refreshGroups(), refreshSelectedGroup(input.groupId)]);
      } catch (error) {
        setGroupsError(error instanceof Error ? error.message : 'No se pudo registrar el gasto');
      } finally {
        setGroupsBusy(false);
      }
    },
    [refreshGroups, refreshSelectedGroup, token]
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

  const createSettlement = useCallback(
    async (input: { groupId: string; fromMemberId: string; toMemberId: string; amount: number }) => {
      if (!token) return;

      setGroupsBusy(true);
      setGroupsError(null);

      try {
        await api.createSettlement(token, input.groupId, {
          fromMemberId: input.fromMemberId,
          toMemberId: input.toMemberId,
          amount: input.amount,
          occurredAt: new Date().toISOString(),
        });

        await refreshSelectedGroup(input.groupId);
      } catch (error) {
        setGroupsError(error instanceof Error ? error.message : 'No se pudo crear la liquidación');
      } finally {
        setGroupsBusy(false);
      }
    },
    [refreshSelectedGroup, token]
  );

  const confirmSettlement = useCallback(
    async (groupId: string, settlementId: string) => {
      if (!token) return;

      setGroupsBusy(true);
      setGroupsError(null);

      try {
        await api.updateSettlementStatus(token, groupId, settlementId, 'confirmed');
        await refreshSelectedGroup(groupId);
      } catch (error) {
        setGroupsError(error instanceof Error ? error.message : 'No se pudo confirmar la liquidación');
      } finally {
        setGroupsBusy(false);
      }
    },
    [refreshSelectedGroup, token]
  );

  const dashboardSummary = useMemo(() => {
    const totals = transactions.reduce(
      (summary, transaction) => {
        const amount = Number(transaction.amount);
        const value = Number.isFinite(amount) ? amount : 0;

        if (transaction.type === 'income') {
          summary.income += value;
        } else {
          summary.expense += value;
        }

        return summary;
      },
      { income: 0, expense: 0 }
    );

    return {
      income: totals.income,
      expense: totals.expense,
      balance: totals.income - totals.expense,
    };
  }, [transactions]);

  return {
    activeTab,
    addGroupExpense,
    addGroupMember,
    authBusy,
    authError,
    booting,
    confirmSettlement,
    createGroup,
    createSettlement,
    createTransaction,
    dashboardSummary,
    dataBusy,
    groups,
    groupsBusy,
    groupsError,
    groupsNotice: GROUPS_NOTICE,
    health,
    isAuthenticated: Boolean(user && token),
    login,
    logout,
    refreshGroups,
    refreshSelectedGroup,
    refreshTransactions,
    register,
    selectedGroupData,
    selectedGroupId,
    setActiveTab,
    setSelectedGroupId,
    transactionError,
    transactions,
    user,
  };
};
