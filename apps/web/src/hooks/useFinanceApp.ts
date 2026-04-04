import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { storage } from '@/lib/storage';
import type {
  ApiHealth,
  AppTab,
  AuthUser,
  GlobalBalancePayload,
  GroupBalancesPayload,
  GroupSummary,
  Transaction,
} from '@/types';

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

const GROUPS_NOTICE = 'Tus grupos se sincronizan con la API, tienen código fijo de acceso y afectan tu balance global.';
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
    setSelectedGroupJoinCode(null);
    setBalanceSummary(EMPTY_BALANCE_SUMMARY);
    setAuthError(null);
    setTransactionError(null);
    setGroupsError(null);
    setActiveTabState('home');
    setHash('home');
  }, []);

  const refreshBalance = useCallback(async () => {
    if (!token) return EMPTY_BALANCE_SUMMARY;

    try {
      const nextBalance = await api.balance(token);
      setBalanceSummary(nextBalance);
      return nextBalance;
    } catch {
      return EMPTY_BALANCE_SUMMARY;
    }
  }, [token]);

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
        const selectedGroup = groups.find(group => group.id === groupId);
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
        setGroupsError(error instanceof Error ? error.message : 'No se pudo cargar el detalle del grupo');
        setSelectedGroupJoinCode(null);
        return null;
      } finally {
        setGroupsBusy(false);
      }
    },
    [groups, token, user?.id]
  );

  const loadSession = useCallback(
    async (sessionToken: string) => {
      setBooting(true);
      setDataBusy(true);
      setGroupsBusy(true);

      try {
        const [nextUser, nextTransactions, nextGroups, nextBalance] = await Promise.all([
          api.me(sessionToken),
          api.transactions(sessionToken),
          api.groups(sessionToken),
          api.balance(sessionToken),
        ]);

        setUser(nextUser);
        setTransactions(nextTransactions);
        setGroups(nextGroups);
        setBalanceSummary(nextBalance);

        const firstGroupId = nextGroups[0]?.id ?? null;
        setSelectedGroupId(firstGroupId);

        if (firstGroupId) {
          try {
            const firstGroup = nextGroups.find(group => group.id === firstGroupId);
            const currentMembership = firstGroup?.members.find(member => member.userId === nextUser.id);
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
      setBalanceSummary(EMPTY_BALANCE_SUMMARY);
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
      const [nextTransactions, nextBalance] = await Promise.all([api.transactions(token), api.balance(token)]);
      setTransactions(nextTransactions);
      setBalanceSummary(nextBalance);
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
        const nextBalance = await api.balance(token);
        setBalanceSummary(nextBalance);
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

        await Promise.all([refreshGroups(), refreshSelectedGroup(input.groupId), refreshBalance()]);
      } catch (error) {
        setGroupsError(error instanceof Error ? error.message : 'No se pudo registrar el gasto');
      } finally {
        setGroupsBusy(false);
      }
    },
    [refreshBalance, refreshGroups, refreshSelectedGroup, token]
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

  const joinGroupByCode = useCallback(
    async (code: string) => {
      if (!token) return;

      setGroupsBusy(true);
      setGroupsError(null);

      try {
        const result = await api.joinGroupByCode(token, code.trim().toUpperCase());
        await Promise.all([refreshGroups(), refreshBalance()]);
        setSelectedGroupId(result.group.id);
        await refreshSelectedGroup(result.group.id);
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

      try {
        await api.createSettlement(token, input.groupId, {
          fromMemberId: input.fromMemberId,
          toMemberId: input.toMemberId,
          amount: input.amount,
          occurredAt: new Date().toISOString(),
        });

        await Promise.all([refreshSelectedGroup(input.groupId), refreshBalance()]);
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
        await Promise.all([refreshSelectedGroup(groupId), refreshBalance()]);
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
    joinGroupByCode,
    login,
    logout,
    refreshBalance,
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
    transactions,
    user,
  };
};
