import { formatMoney } from '@/lib/format';
import type { Budget } from '@/types';

type BudgetCardProps = {
  budget: Budget;
  categoryName: string;
  currency: string;
};

const getProgressColor = (consumedPercent: number, isOverBudget: boolean) => {
  if (isOverBudget) return 'budget-bar--over';
  if (consumedPercent >= 100) return 'budget-bar--over';
  if (consumedPercent >= 80) return 'budget-bar--warning';
  return 'budget-bar--ok';
};

const getStatusLabel = (consumedPercent: number, isOverBudget: boolean) => {
  if (isOverBudget) return 'Presupuesto excedido';
  if (consumedPercent >= 100) return 'Presupuesto excedido';
  if (consumedPercent >= 80) return 'Cerca del límite';
  return 'Dentro del presupuesto';
};

const getClampedPercent = (consumedPercent: number) => Math.min(consumedPercent, 100);

export const BudgetCard = ({ budget, categoryName, currency }: BudgetCardProps) => {
  const colorClass = getProgressColor(budget.consumedPercent, budget.isOverBudget);
  const statusLabel = getStatusLabel(budget.consumedPercent, budget.isOverBudget);
  const clampedPercent = getClampedPercent(budget.consumedPercent);

  return (
    <article className="budget-card">
      <div className="budget-card__header">
        <span className="category-tag">{categoryName}</span>
        <span className="budget-card__amount">{formatMoney(budget.amount, currency)}</span>
      </div>

      <div className="budget-metrics">
        <div className="budget-metrics__row">
          <span className="budget-metrics__label">Gastado</span>
          <span className={`budget-metrics__value ${budget.isOverBudget ? 'budget-metrics__value--over' : ''}`}>
            {formatMoney(budget.spent, currency)}
          </span>
        </div>
        <div className="budget-metrics__row">
          <span className="budget-metrics__label">Disponible</span>
          <span className={`budget-metrics__value ${budget.isOverBudget ? 'budget-metrics__value--over' : ''}`}>
            {formatMoney(budget.available, currency)}
          </span>
        </div>
        <div className="budget-metrics__row">
          <span className="budget-metrics__label">Consumido</span>
          <span className="budget-metrics__value">{Math.round(budget.consumedPercent)}%</span>
        </div>
      </div>

      <div
        className="budget-bar-track"
        role="progressbar"
        aria-valuenow={clampedPercent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuetext={`${statusLabel}: ${Math.round(budget.consumedPercent)}% consumido`}
        aria-label={statusLabel}
      >
        <div
          className={`budget-bar ${colorClass}`}
          style={{ width: `${clampedPercent}%` }}
        />
      </div>

      <div className="budget-status">
        <span className={`budget-status__dot ${colorClass}`} />
        <span className="budget-status__text">{statusLabel}</span>
      </div>
    </article>
  );
};
