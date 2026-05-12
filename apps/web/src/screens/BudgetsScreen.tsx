import { useEffect, useRef, useState } from 'react';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { BudgetForm } from '@/components/budgets/BudgetForm';
import { formatMoney } from '@/lib/format';
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

  const getProgressColor = (consumedPercent: number, isOverBudget: boolean) => {
    if (isOverBudget) return 'budget-bar--over';
    if (consumedPercent >= 100) return 'budget-bar--over';
    if (consumedPercent >= 80) return 'budget-bar--warning';
    return 'budget-bar--ok';
  };

  const getStatusLabel = (consumedPercent: number, isOverBudget: boolean) => {
    if (isOverBudget) return 'Presupuesto excedido';
    if (consumedPercent >= 100) return 'Límite alcanzado';
    if (consumedPercent >= 80) return 'Cerca del límite';
    return 'Dentro del presupuesto';
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
              <article key={budget.id} className="list-row list-row--stacked budget-row">
                <div className="list-row__content">
                  <div className="list-row__title">
                    <span className="category-tag">
                      {getCategoryName(budget.categoryId)}
                    </span>
                  </div>
                  <div className="budget-metrics">
                    <div className="budget-metrics__row">
                      <span className="budget-metrics__label">Gastado</span>
                      <span className={`budget-metrics__value ${budget.isOverBudget ? 'budget-metrics__value--over' : ''}`}>
                        {formatMoney(budget.spent, user.currency)}
                      </span>
                    </div>
                    <div className="budget-metrics__row">
                      <span className="budget-metrics__label">Disponible</span>
                      <span className={`budget-metrics__value ${budget.isOverBudget ? 'budget-metrics__value--over' : ''}`}>
                        {formatMoney(budget.available, user.currency)}
                      </span>
                    </div>
                    <div className="budget-metrics__row">
                      <span className="budget-metrics__label">Consumido</span>
                      <span className="budget-metrics__value">{Math.round(budget.consumedPercent)}%</span>
                    </div>
                  </div>
                  <div className="budget-bar-track" role="progressbar" aria-valuenow={Math.min(budget.consumedPercent, 100)} aria-valuemin={0} aria-valuemax={100} aria-label={getStatusLabel(budget.consumedPercent, budget.isOverBudget)}>
                    <div
                      className={`budget-bar ${getProgressColor(budget.consumedPercent, budget.isOverBudget)}`}
                      style={{ width: `${Math.min(budget.consumedPercent, 100)}%` }}
                    />
                  </div>
                  <div className="budget-status">
                    <span className={`budget-status__dot ${getProgressColor(budget.consumedPercent, budget.isOverBudget)}`} />
                    <span className="budget-status__text">{getStatusLabel(budget.consumedPercent, budget.isOverBudget)}</span>
                  </div>
                </div>
                <div className="list-row__actions">
                  <span className="amount-pill amount-pill--accent">
                    {formatMoney(budget.amount, user.currency)}
                  </span>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
