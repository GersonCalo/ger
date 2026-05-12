import { useEffect, useState } from 'react';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { BudgetForm } from '@/components/budgets/BudgetForm';
import { formatMoney } from '@/lib/format';
import { useToast } from '@/hooks/useToast';
import type { AuthUser, Budget, Category } from '@/types';

type BudgetsScreenProps = {
  budgets: Budget[];
  budgetsBusy: boolean;
  budgetsError: string | null;
  categories: Category[];
  user: AuthUser;
  onCreateBudget: (input: { categoryId: string; amount: number; month: number; year: number }) => Promise<Budget>;
  onRefreshBudgets: () => Promise<void>;
};

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const getMonthLabel = (month: number) => MONTH_NAMES[month - 1] ?? String(month);

export const BudgetsScreen = ({
  budgets,
  budgetsBusy,
  budgetsError,
  categories,
  user,
  onCreateBudget,
  onRefreshBudgets,
}: BudgetsScreenProps) => {
  const { showToast } = useToast();
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    if (!budgetsBusy && !budgetsError && budgets.length === 0) {
      void onRefreshBudgets();
    }
  }, []);

  const handleCreateSuccess = () => {
    setModalOpen(false);
  };

  const handleRefreshError = async () => {
    await onRefreshBudgets();
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
              <article key={budget.id} className="list-row list-row--stacked">
                <div className="list-row__content">
                  <div className="list-row__title">
                    <span className="category-tag">
                      {getCategoryName(budget.categoryId)}
                    </span>
                  </div>
                  <div className="list-row__meta">
                    {getMonthLabel(budget.month)} {budget.year}
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
