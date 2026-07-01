import { useCallback, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { isPushEnabled, isPushSupported } from '@/lib/push';
import type { BudgetAlertTriggered, GlobalBalancePayload, Transaction, TransactionListFilters } from '@/types';

type UseTransactionsParams = {
  token: string | null;
};

const EMPTY_BALANCE_SUMMARY: GlobalBalancePayload = {
  personalIncome: 0,
  personalExpense: 0,
  personalBalance: 0,
  groupNet: 0,
  totalBalance: 0,
  groupsBreakdown: [],
};

export const useTransactions = ({ token }: UseTransactionsParams) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [dataBusy, setDataBusy] = useState(false);
  const [transactionError, setTransactionError] = useState<string | null>(null);
  const [transactionFilters, setTransactionFilters] = useState<TransactionListFilters>({});
  const [txNextCursor, setTxNextCursor] = useState<string | null>(null);
  const [txHasMore, setTxHasMore] = useState(false);
  const [txLoadingMore, setTxLoadingMore] = useState(false);
  const [balanceSummary, setBalanceSummary] = useState<GlobalBalancePayload>(EMPTY_BALANCE_SUMMARY);

  const reset = useCallback(() => {
    setTransactions([]);
    setDataBusy(false);
    setTransactionError(null);
    setTransactionFilters({});
    setTxNextCursor(null);
    setTxHasMore(false);
    setTxLoadingMore(false);
    setBalanceSummary(EMPTY_BALANCE_SUMMARY);
  }, []);

  const hydrate = useCallback((payload: {
    transactions: Transaction[];
    nextCursor: string | null;
    hasMore: boolean;
    balance: GlobalBalancePayload;
  }) => {
    setTransactions(payload.transactions);
    setTxNextCursor(payload.nextCursor);
    setTxHasMore(payload.hasMore);
    setBalanceSummary(payload.balance);
  }, []);

  const refreshBalance = useCallback(
    async (options?: { silent?: boolean }) => {
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
    },
    [token]
  );

  const refreshTransactions = useCallback(
    async (options?: { silent?: boolean; filters?: TransactionListFilters }) => {
      if (!token) return;
      if (!options?.silent) setDataBusy(true);

      const filters = options?.filters ?? transactionFilters;

      try {
        const res = await api.transactions(token, filters);
        setTransactions(res.transactions || []);
        setTxNextCursor(res.nextCursor);
        setTxHasMore(res.hasMore);
        setTransactionError(null);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Error cargando historial';
        setTransactionError(message);
      } finally {
        if (!options?.silent) setDataBusy(false);
      }
    },
    [token, transactionFilters]
  );

  const applyTransactionFilters = useCallback(
    async (filters: TransactionListFilters) => {
      setTransactionFilters(filters);
      if (!token) return;
      setDataBusy(true);
      try {
        const res = await api.transactions(token, filters);
        setTransactions(res.transactions || []);
        setTxNextCursor(res.nextCursor);
        setTxHasMore(res.hasMore);
        setTransactionError(null);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Error aplicando filtros';
        setTransactionError(message);
      } finally {
        setDataBusy(false);
      }
    },
    [token]
  );

  const loadMoreTransactions = useCallback(
    async () => {
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
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Error cargando mas movimientos';
        setTransactionError(message);
      } finally {
        setTxLoadingMore(false);
      }
    },
    [token, transactionFilters, txLoadingMore, txNextCursor]
  );

  const exportTransactionsCsv = useCallback(
    async () => {
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
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Error exportando movimientos';
        setTransactionError(message);
      }
    },
    [token, transactionFilters]
  );

  const createTransaction = useCallback(
    async (input: { type: 'income' | 'expense'; amount: number; categoryId?: string; note?: string; occurredAt: string }) => {
      if (!token) return { alertsTriggered: [] as BudgetAlertTriggered[] };
      setDataBusy(true);
      setTransactionError(null);
      try {
        const result = await api.createTransaction(token, input);
        setTransactions(prev => [result.transaction, ...prev]);
        await refreshBalance();
        return { alertsTriggered: result.alertsTriggered };
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Error guardando transaccion';
        setTransactionError(message);
        throw error;
      } finally {
        setDataBusy(false);
      }
    },
    [refreshBalance, token]
  );

  const updateTransaction = useCallback(
    async (input: { id: string; type?: 'income' | 'expense'; amount?: number; categoryId?: string | null; note?: string | null; occurredAt?: string }) => {
      if (!token) return { alertsTriggered: [] as BudgetAlertTriggered[] };
      setDataBusy(true);
      setTransactionError(null);
      try {
        const result = await api.updateTransaction(token, input.id, {
          type: input.type,
          amount: input.amount,
          categoryId: input.categoryId,
          note: input.note,
          occurredAt: input.occurredAt,
        });
        await Promise.all([refreshBalance({ silent: true }), refreshTransactions({ silent: true })]);
        return { alertsTriggered: result.alertsTriggered };
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Error actualizando transaccion';
        setTransactionError(message);
        throw error;
      } finally {
        setDataBusy(false);
      }
    },
    [refreshBalance, refreshTransactions, token]
  );

  const deleteTransaction = useCallback(
    async (id: string) => {
      if (!token) return;
      setDataBusy(true);
      setTransactionError(null);
      try {
        await api.deleteTransaction(token, id);
        await Promise.all([refreshBalance({ silent: true }), refreshTransactions({ silent: true })]);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Error eliminando transaccion';
        setTransactionError(message);
        throw error;
      } finally {
        setDataBusy(false);
      }
    },
    [refreshBalance, refreshTransactions, token]
  );

  const dashboardSummary = useMemo(
    () => ({
      income: balanceSummary.personalIncome,
      expense: balanceSummary.personalExpense,
      balance: balanceSummary.personalBalance,
      groupNet: balanceSummary.groupNet,
      total: balanceSummary.totalBalance,
    }),
    [balanceSummary]
  );

  return {
    transactions,
    dataBusy,
    transactionError,
    transactionFilters,
    txNextCursor,
    txHasMore,
    txLoadingMore,
    balanceSummary,
    refreshBalance,
    refreshTransactions,
    applyTransactionFilters,
    loadMoreTransactions,
    exportTransactionsCsv,
    createTransaction,
    updateTransaction,
    deleteTransaction,
    dashboardSummary,
    hydrate,
    reset,
  };
};
