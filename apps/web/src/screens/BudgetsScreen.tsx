import { useEffect, useRef, useState } from 'react';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { BudgetForm } from '@/components/budgets/BudgetForm';
import { BudgetCard } from '@/components/BudgetCard';
import { useToast } from '@/hooks/useToast';
import type { AuthUser, Budget, Category, Transaction } from '@/types';

type BudgetsScreenProps = {
  budgets: Budget[];
  budgetsBusy: boolean;
  budgetsError: string | null;
  categories: Category[];
  user: AuthUser;
  onCreateBudget: (input: { categoryId: string; amount: number; month: number; year: number; recurring?: boolean; monthsCount?: number }) => Promise<{ budgets: Budget[]; duplicates?: Array<{ month: number; year: number }> }>;
  onRefreshBudgets: (options?: { silent?: boolean; filters?: { month?: number; year?: number; period?: 'monthly'; categoryId?: string } }) => Promise<void>;
  transactions: Transaction[];
};

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const getCurrentMonthYear = () => {
  const now = new Date();
  return { month: now.getMonth() + 1, year: now.getFullYear() };
};

const getMonthLabel = (month: number) => MONTH_NAMES[month - 1] ?? String(month);

export const BudgetsScreen = ({
  budgets,
  budgetsBusy,
  budgetsError,
  categories,
  user,
  onCreateBudget,
  onRefreshBudgets,
  transactions,
}: BudgetsScreenProps) => {
  const { showToast } = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const { month: currentMonth, year: currentYear } = getCurrentMonthYear();
  const prevTxCountRef = useRef(transactions.length);

  useEffect(() => {
    void onRefreshBudgets({ filters: { month: currentMonth, year: currentYear } });
  }, []);

  useEffect(() => {
    if (transactions.length !== prevTxCountRef.current) {
      prevTxCountRef.current = transactions.length;
      void onRefreshBudgets({ silent: true, filters: { month: currentMonth, year: currentYear } });
    }
  }, [transactions]);

  const handleCreateSuccess = () => {
    setModalOpen(false);
    void onRefreshBudgets({ filters: { month: currentMonth, year: currentYear } });
  };

  const handleRefreshError = async () => {
    await onRefreshBudgets({ filters: { month: currentMonth, year: currentYear } });
  };

  const sortedBudgets = [...budgets].sort((a, b) => {
    if (a.year !== b.year) return b.year - a.year;
    if (a.month !== b.month) return b.month - a.month;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const getCategoryName = (categoryId: string) => {
    const cat = categories.find(c => c.id === categoryId);
    return cat ? `${cat.icon ? `${cat.icon} ` : ''}${cat.name}` : 'Sin categoría';
  };

  return (
    <div className="screen-stack">
      <section className="screen-intro">
        <div className="screen-intro__eyebrow">Planificación</div>
        <h2 className="screen-intro__title">Presupuestos</h2>
        <p className="screen-intro__body">{getMonthLabel(currentMonth)} {currentYear}</p>
      </section>

      <div className="section-card">
        <button
          type="button"
          className="button button--primary"
          onClick={() => setModalOpen(true)}
        >
          Nuevo presupuesto
        </button>
      </div>

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Nuevo presupuesto"
        size="md"
      >
        <BudgetForm
          categories={categories}
          onSubmit={onCreateBudget}
          onSuccess={handleCreateSuccess}
        />
      </Modal>

      <section className="section-card">
        {budgetsBusy && sortedBudgets.length === 0 ? (
          <EmptyState
            icon="⏳"
            title="Cargando presupuestos"
            description="Recuperando tus límites de gasto..."
          />
        ) : budgetsError && sortedBudgets.length === 0 ? (
          <EmptyState
            icon="⚠️"
            title="Error al cargar"
            description={budgetsError}
            actionLabel="Reintentar"
            onAction={handleRefreshError}
          />
        ) : sortedBudgets.length === 0 ? (
          <EmptyState
            icon="📊"
            title="Sin presupuestos"
            description="Define límites de gasto por categoría y mes para controlar tus finanzas."
          />
        ) : (
          <div className="list-stack">
            {sortedBudgets.map(budget => (
              <BudgetCard
                key={budget.id}
                budget={budget}
                categoryName={getCategoryName(budget.categoryId)}
                currency={user.currency}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
