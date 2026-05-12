import { useCallback, useEffect, useRef, useState } from 'react';
import { useToast } from '@/hooks/useToast';
import type { Budget, Category } from '@/types';

type BudgetFormProps = {
  categories: Category[];
  onSubmit: (input: { categoryId: string; amount: number; month: number; year: number }) => Promise<Budget>;
  onSuccess: () => void;
};

const getCurrentMonthYear = () => {
  const now = new Date();
  return { month: now.getMonth() + 1, year: now.getFullYear() };
};

const toMonthInputValue = (month: number, year: number) =>
  `${year}-${String(month).padStart(2, '0')}`;

const fromMonthInputValue = (value: string) => {
  const [yearStr, monthStr] = value.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  return { month, year };
};

export const BudgetForm = ({ categories, onSubmit, onSuccess }: BudgetFormProps) => {
  const { showToast } = useToast();
  const [categoryId, setCategoryId] = useState('');
  const [amount, setAmount] = useState('');
  const defaultPeriod = getCurrentMonthYear();
  const [periodValue, setPeriodValue] = useState(toMonthInputValue(defaultPeriod.month, defaultPeriod.year));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const successTimerRef = useRef<number | null>(null);
  const [justAdded, setJustAdded] = useState(false);

  const resetForm = useCallback(() => {
    setCategoryId('');
    setAmount('');
    const next = getCurrentMonthYear();
    setPeriodValue(toMonthInputValue(next.month, next.year));
    setError(null);
  }, []);

  useEffect(() => {
    return () => {
      if (successTimerRef.current) {
        window.clearTimeout(successTimerRef.current);
      }
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const parsedAmount = Number(amount);
    if (!amount || !Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError('Ingresa un monto válido mayor a 0');
      return;
    }

    if (!categoryId) {
      setError('Selecciona una categoría');
      return;
    }

    const { month, year } = fromMonthInputValue(periodValue);
    if (!month || !year || month < 1 || month > 12 || year < 2020 || year > 2099) {
      setError('Selecciona un período válido');
      return;
    }

    setBusy(true);
    try {
      await onSubmit({ categoryId, amount: parsedAmount, month, year });
      setJustAdded(true);
      successTimerRef.current = window.setTimeout(() => setJustAdded(false), 1400);
      showToast({ message: 'Presupuesto creado', type: 'success' });
      resetForm();
      onSuccess();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudo crear el presupuesto';
      setError(message);
    } finally {
      setBusy(false);
    }
  };

  const expenseCategories = categories.filter(c => c.type === 'expense' && c.groupId === null);

  return (
    <form
      className={`form-stack ${justAdded ? 'form-stack--success' : ''}`}
      onSubmit={handleSubmit}
    >
      <label className="field">
        <span className="field__label">Categoría</span>
        <select
          className="field__input"
          value={categoryId}
          onChange={e => setCategoryId(e.target.value)}
          disabled={busy}
        >
          <option value="">Seleccionar categoría</option>
          {expenseCategories.map(c => (
            <option key={c.id} value={c.id}>
              {c.icon ? `${c.icon} ` : ''}{c.name}
            </option>
          ))}
        </select>
      </label>

      <label className="field field--amount">
        <span className="field__label">Monto máximo</span>
        <input
          className="field__input field__input--amount"
          type="number"
          inputMode="decimal"
          step="0.01"
          placeholder="0.00"
          value={amount}
          onChange={e => setAmount(e.target.value)}
          disabled={busy}
        />
      </label>

      <label className="field">
        <span className="field__label">Período</span>
        <input
          className="field__input"
          type="month"
          value={periodValue}
          onChange={e => setPeriodValue(e.target.value)}
          disabled={busy}
        />
      </label>

      {error ? <div className="form-error">{error}</div> : null}

      <button type="submit" className="button button--primary" disabled={busy || !amount || !categoryId}>
        {busy ? 'Guardando...' : 'Crear presupuesto'}
      </button>
    </form>
  );
};
