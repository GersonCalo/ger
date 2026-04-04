import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { createId, createStarterGroup } from '@/lib/groups';
import { storage } from '@/lib/storage';
import type { ApiHealth, AppTab, AuthUser, LocalGroup, Transaction } from '@/types';

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

export const useFinanceApp = () => {
  const [activeTab, setActiveTabState] = useState<AppTab>(getInitialTab);
  const [token, setToken] = useState<string | null>(() => storage.getToken());
  const [user, setUser] = useState<AuthUser | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [groups, setGroups] = useState<LocalGroup[]>([]);
  const [health, setHealth] = useState<ApiHealth | null>(null);
  const [booting, setBooting] = useState(Boolean(storage.getToken()));
  const [authBusy, setAuthBusy] = useState(false);
  const [dataBusy, setDataBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [transactionError, setTransactionError] = useState<string | null>(null);
  const [groupsNotice, setGroupsNotice] = useState('Tus grupos se guardan localmente hasta conectar el backend de grupos.');

  useEffect(() => {
    const onHashChange = () => setActiveTabState(getInitialTab());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    storage.setGroups(user.id, groups);
  }, [groups, user?.id]);

  useEffect(() => {
    api.health().then(setHealth).catch(() => setHealth(null));
  }, []);

  const logout = useCallback(() => {
    storage.clearToken();
    setToken(null);
    setUser(null);
    setTransactions([]);
    setGroups([]);
    setAuthError(null);
    setTransactionError(null);
    setActiveTabState('home');
    setHash('home');
  }, []);

  const loadSession = useCallback(
    async (sessionToken: string) => {
      setBooting(true);
      setDataBusy(true);

      try {
        const [nextUser, nextTransactions] = await Promise.all([api.me(sessionToken), api.transactions(sessionToken)]);
        const storedGroups = storage.getGroups(nextUser.id);
        setUser(nextUser);
        setTransactions(nextTransactions);
        setGroups(storedGroups.length > 0 ? storedGroups : [createStarterGroup(nextUser.name, nextUser.currency)]);
      } catch {
        logout();
      } finally {
        setBooting(false);
        setDataBusy(false);
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

  const setActiveTab = useCallback((tab: AppTab) => {
    setActiveTabState(tab);
    setHash(tab);
  }, []);

  const onAuthSuccess = useCallback((response: { token: string; user: AuthUser }) => {
    storage.setToken(response.token);
    setToken(response.token);
    setUser(response.user);
    setAuthError(null);
    setActiveTab('home');
  }, [setActiveTab]);

  const login = useCallback(async (input: { email: string; password: string }) => {
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
  }, [onAuthSuccess]);

  const register = useCallback(async (input: { email: string; password: string; name?: string }) => {
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
  }, [onAuthSuccess]);

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
    (input: { name: string; guestMembers: string[] }) => {
      if (!user) return;

      const members = [
        { id: createId(), name: user.name || 'Tú', kind: 'me' as const, weight: 1 },
        ...input.guestMembers
          .filter(Boolean)
          .map(name => ({ id: createId(), name, kind: 'guest' as const, weight: 1 })),
      ];

      const group: LocalGroup = {
        id: createId(),
        name: input.name,
        currency: user.currency,
        createdAt: new Date().toISOString(),
        members,
        expenses: [],
      };

      setGroups(current => [group, ...current]);
      setGroupsNotice('Tus grupos se están guardando localmente en este dispositivo.');
      setActiveTab('groups');
    },
    [setActiveTab, user]
  );

  const addGroupExpense = useCallback(
    (input: {
      groupId: string;
      description: string;
      amount: number;
      payerMemberId: string;
      splitMethod: 'equal' | 'weights';
    }) => {
      setGroups(current =>
        current.map(group =>
          group.id === input.groupId
            ? {
                ...group,
                expenses: [
                  {
                    id: createId(),
                    description: input.description,
                    amount: input.amount,
                    payerMemberId: input.payerMemberId,
                    splitMethod: input.splitMethod,
                    occurredAt: new Date().toISOString(),
                  },
                  ...group.expenses,
                ],
              }
            : group
        )
      );
    },
    []
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
    authBusy,
    authError,
    booting,
    createGroup,
    createTransaction,
    dashboardSummary,
    dataBusy,
    groups,
    groupsNotice,
    health,
    isAuthenticated: Boolean(user && token),
    login,
    logout,
    refreshTransactions,
    register,
    setActiveTab,
    transactionError,
    transactions,
    addGroupExpense,
    user,
  };
};
