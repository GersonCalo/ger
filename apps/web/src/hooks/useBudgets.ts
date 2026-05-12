import { useCallback, useState } from 'react';
import { api } from '@/lib/api';
import type { Budget, BudgetListFilters } from '@/types';

type UseBudgetsParams = {
  token: string | null;
};

export const useBudgets = ({ token }: UseBudgetsParams) => {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [budgetsBusy, setBudgetsBusy] = useState(false);
  const [budgetsError, setBudgetsError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setBudgets([]);
    setBudgetsBusy(false);
    setBudgetsError(null);
  }, []);

  const hydrate = useCallback((next: Budget[]) => {
    setBudgets(next);
  }, []);

  const refreshBudgets = useCallback(
    async (options?: { silent?: boolean; filters?: BudgetListFilters }) => {
      if (!token) return;
      if (!options?.silent) setBudgetsBusy(true);
      try {
        const next = await api.getBudgets(token, options?.filters);
        setBudgets(next);
        setBudgetsError(null);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Error cargando presupuestos';
        setBudgetsError(message);
      } finally {
        if (!options?.silent) setBudgetsBusy(false);
      }
    },
    [token]
  );

  const createBudget = useCallback(
    async (input: { categoryId: string; amount: number; month: number; year: number; recurring?: boolean; monthsCount?: number }) => {
      if (!token) throw new Error('No auth');
      setBudgetsBusy(true);
      setBudgetsError(null);
      try {
        const result = await api.createBudget(token, {
          categoryId: input.categoryId,
          amount: input.amount,
          period: 'monthly',
          month: input.month,
          year: input.year,
          recurring: input.recurring,
          monthsCount: input.monthsCount,
        });
        setBudgets(prev => {
          const existingIds = new Set(prev.map(b => b.id));
          const newBudgets = result.budgets.filter(b => !existingIds.has(b.id));
          return [...prev, ...newBudgets].sort((a, b) => {
            if (a.year !== b.year) return b.year - a.year;
            if (a.month !== b.month) return b.month - a.month;
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          });
        });
        return result;
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Error creando presupuesto';
        setBudgetsError(message);
        throw error;
      } finally {
        setBudgetsBusy(false);
      }
    },
    [token]
  );

  return {
    budgets,
    budgetsBusy,
    budgetsError,
    refreshBudgets,
    createBudget,
    hydrate,
    reset,
  };
};
