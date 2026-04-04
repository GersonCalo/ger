import { useMemo, useState } from 'react';
import { EmptyState } from '@/components/EmptyState';
import { SectionCard } from '@/components/SectionCard';
import { StatCard } from '@/components/StatCard';
import { formatDate, formatMoney } from '@/lib/format';
import type { AuthUser, Transaction } from '@/types';

type TransactionsScreenProps = {
  busy: boolean;
  error: string | null;
  onCreateTransaction: (input: { type: 'income' | 'expense'; amount: number; category?: string; note?: string }) => Promise<void>;
  onRefresh: () => Promise<void>;
  summary: {
    balance: number;
    income: number;
    expense: number;
  };
  transactions: Transaction[];
  user: AuthUser;
};

export const TransactionsScreen = ({
  busy,
  error,
  onCreateTransaction,
  onRefresh,
  summary,
  transactions,
  user,
}: TransactionsScreenProps) => {
  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [note, setNote] = useState('');
  const [filter, setFilter] = useState<'all' | 'income' | 'expense'>('all');

  const filteredTransactions = useMemo(() => {
    if (filter === 'all') return transactions;
    return transactions.filter(transaction => transaction.type === filter);
  }, [filter, transactions]);

  return (
    <div className="screen-stack">
      <section className="screen-intro">
        <div className="screen-intro__eyebrow">Actividad personal</div>
        <h2 className="screen-intro__title">Movimientos del día a día</h2>
        <p className="screen-intro__body">Captura nuevos importes y revisa tu historial sin mezclar pasos ni perder contexto.</p>
      </section>

      <div className="stats-grid">
        <StatCard label="Saldo" value={formatMoney(summary.balance, user.currency)} tone="accent" />
        <StatCard label="Ingresos" value={formatMoney(summary.income, user.currency)} tone="positive" />
        <StatCard label="Gastos" value={formatMoney(summary.expense, user.currency)} tone="warning" />
      </div>

      <SectionCard
        title="Nuevo movimiento"
        subtitle="Registra un ingreso o un gasto con una estructura más directa."
        action={
          <button type="button" className="button button--ghost button--small" onClick={onRefresh} disabled={busy}>
            Actualizar
          </button>
        }
      >
        <div className="segmented-control">
          <button
            type="button"
            className={`segmented-control__item ${type === 'expense' ? 'segmented-control__item--active' : ''}`}
            onClick={() => setType('expense')}
          >
            Gasto
          </button>
          <button
            type="button"
            className={`segmented-control__item ${type === 'income' ? 'segmented-control__item--active' : ''}`}
            onClick={() => setType('income')}
          >
            Ingreso
          </button>
        </div>

        <form
          className="form-stack"
          onSubmit={async event => {
            event.preventDefault();

            if (!amount) return;

            await onCreateTransaction({
              type,
              amount: Number(amount),
              category: category || undefined,
              note: note || undefined,
            });

            setAmount('');
            setCategory('');
            setNote('');
          }}
        >
          <label className="field">
            <span className="field__label">Monto</span>
            <input
              className="field__input"
              type="number"
              inputMode="decimal"
              step="0.01"
              placeholder="0.00"
              value={amount}
              onChange={event => setAmount(event.target.value)}
            />
          </label>

          <label className="field">
            <span className="field__label">Categoría</span>
            <input
              className="field__input"
              type="text"
              placeholder="Comida, nómina, transporte..."
              value={category}
              onChange={event => setCategory(event.target.value)}
            />
          </label>

          <label className="field">
            <span className="field__label">Nota</span>
            <input
              className="field__input"
              type="text"
              placeholder="Añade contexto si lo necesitas"
              value={note}
              onChange={event => setNote(event.target.value)}
            />
          </label>

          {error ? <div className="form-error">{error}</div> : null}

          <button type="submit" className="button button--primary" disabled={busy || !amount}>
            {busy ? 'Guardando...' : 'Guardar movimiento'}
          </button>
        </form>
      </SectionCard>

      <SectionCard title="Historial" subtitle="Filtra y revisa tu actividad personal.">
        <div className="segmented-control">
          <button
            type="button"
            className={`segmented-control__item ${filter === 'all' ? 'segmented-control__item--active' : ''}`}
            onClick={() => setFilter('all')}
          >
            Todo
          </button>
          <button
            type="button"
            className={`segmented-control__item ${filter === 'income' ? 'segmented-control__item--active' : ''}`}
            onClick={() => setFilter('income')}
          >
            Ingresos
          </button>
          <button
            type="button"
            className={`segmented-control__item ${filter === 'expense' ? 'segmented-control__item--active' : ''}`}
            onClick={() => setFilter('expense')}
          >
            Gastos
          </button>
        </div>

        {filteredTransactions.length === 0 ? (
          <EmptyState
            title="No hay movimientos en este filtro"
            description="Prueba a cambiar el filtro o registra una nueva transacción."
          />
        ) : (
          <div className="list-stack">
            {filteredTransactions.map(transaction => {
              const amountValue = Number(transaction.amount) || 0;
              return (
                <article key={transaction.id} className="list-row list-row--stacked">
                  <div className="list-row__content">
                    <div className="list-row__title">
                      {transaction.category || (transaction.type === 'income' ? 'Ingreso' : 'Gasto')}
                    </div>
                    <div className="list-row__meta">{formatDate(transaction.occurredAt)}</div>
                    {transaction.note ? <div className="list-row__note">{transaction.note}</div> : null}
                  </div>
                  <div className={`amount-pill ${transaction.type === 'income' ? 'amount-pill--positive' : 'amount-pill--negative'}`}>
                    {transaction.type === 'income' ? '+' : '-'}
                    {formatMoney(amountValue, user.currency)}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </SectionCard>
    </div>
  );
};
