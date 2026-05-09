import { useMemo, useRef, useState } from 'react';
import { EmptyState } from '@/components/EmptyState';
import { SectionCard } from '@/components/SectionCard';
import { StatCard } from '@/components/StatCard';
import { formatDate, formatMoney } from '@/lib/format';
import type { AuthUser, Transaction, Category } from '@/types';

type TransactionsScreenProps = {
  busy: boolean;
  error: string | null;
  onCreateTransaction: (input: { type: 'income' | 'expense'; amount: number; categoryId?: string; note?: string; occurredAt: string }) => Promise<void>;
  onUpdateTransaction: (input: { id: string; type?: 'income' | 'expense'; amount?: number; categoryId?: string | null; note?: string | null; occurredAt?: string }) => Promise<void>;
  onDeleteTransaction: (id: string) => Promise<void>;
  onCreateCategory: (input: { name: string; type: 'income' | 'expense'; color?: string; icon?: string }) => Promise<any>;
  onRefresh: () => Promise<void>;
  summary: {
    balance: number;
    income: number;
    expense: number;
  };
  transactions: Transaction[];
  user: AuthUser;
  categories: Category[];
};

export const TransactionsScreen = ({
  busy,
  error,
  onCreateTransaction,
  onUpdateTransaction,
  onDeleteTransaction,
  onCreateCategory,
  onRefresh,
  summary,
  transactions,
  user,
  categories,
}: TransactionsScreenProps) => {
  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [note, setNote] = useState('');
  const [filter, setFilter] = useState<'all' | 'income' | 'expense'>('all');
  const [justAdded, setJustAdded] = useState(false);
  
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryIcon, setNewCategoryIcon] = useState('');
  const [creatingCategory, setCreatingCategory] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editType, setEditType] = useState<'income' | 'expense'>('expense');
  const [editAmount, setEditAmount] = useState('');
  const [editCategoryId, setEditCategoryId] = useState('');
  const [editNote, setEditNote] = useState('');
  const [editOccurredAt, setEditOccurredAt] = useState('');

  const startEditing = (transaction: Transaction) => {
    setEditingId(transaction.id);
    setEditType(transaction.type);
    setEditAmount(transaction.amount);
    setEditCategoryId(transaction.categoryId || '');
    setEditNote(transaction.note || '');
    setEditOccurredAt(new Date(transaction.occurredAt).toISOString().slice(0, 16));
  };

  const cancelEditing = () => {
    setEditingId(null);
  };

  const successTimerRef = useRef<number | null>(null);

  const filteredTransactions = useMemo(() => {
    if (filter === 'all') return transactions;
    return transactions.filter(transaction => transaction.type === filter);
  }, [filter, transactions]);

  return (
    <div className="screen-stack">
      <section className="screen-intro">
        <div className="screen-intro__eyebrow">Actividad</div>
        <h2 className="screen-intro__title">Tus movimientos</h2>
      </section>

      <div className="stats-grid">
        <StatCard label="Disponible" value={formatMoney(summary.balance, user.currency)} tone="accent" />
        <StatCard label="Ingresos" value={formatMoney(summary.income, user.currency)} tone="positive" />
        <StatCard label="Gastos" value={formatMoney(summary.expense, user.currency)} tone="warning" />
      </div>

      <SectionCard
        title="Nuevo movimiento"
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
          className={`form-stack ${justAdded ? 'form-stack--success' : ''}`}
          onSubmit={async event => {
            event.preventDefault();

            if (!amount) return;

            await onCreateTransaction({
              type,
              amount: Number(amount),
              categoryId: categoryId || undefined,
              note: note || undefined,
              occurredAt: new Date().toISOString(),
            });

            if (successTimerRef.current) {
              window.clearTimeout(successTimerRef.current);
            }

            setJustAdded(true);
            successTimerRef.current = window.setTimeout(() => setJustAdded(false), 1400);
            setAmount('');
            setCategoryId('');
            setNote('');
          }}
        >
          <label className="field field--amount">
            <span className="field__label">Monto</span>
            <input
              className="field__input field__input--amount"
              type="number"
              inputMode="decimal"
              step="0.01"
              placeholder="0.00"
              value={amount}
              onChange={event => setAmount(event.target.value)}
            />
          </label>

          <label className="field">
            <div className="field__header">
              <span className="field__label">Categoría</span>
              {!showAddCategory && (
                <button
                  type="button"
                  className="field__action"
                  onClick={() => setShowAddCategory(true)}
                >
                  + Nueva
                </button>
              )}
            </div>

            {showAddCategory ? (
              <div className="field__inline-row">
                <input
                  className="field__input"
                  type="text"
                  placeholder="Ej. 🍕 Comida"
                  value={newCategoryName}
                  onChange={e => setNewCategoryName(e.target.value)}
                  disabled={creatingCategory}
                />
                <button
                  type="button"
                  className="button button--primary button--small"
                  disabled={creatingCategory || !newCategoryName.trim()}
                  onClick={async () => {
                    setCreatingCategory(true);
                    try {
                      const iconMatch = newCategoryName.match(/^([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/);
                      const icon = iconMatch ? iconMatch[0] : '';
                      const name = iconMatch ? newCategoryName.slice(icon.length).trim() : newCategoryName.trim();

                      const cat = await onCreateCategory({ name, type, icon });
                      setCategoryId(cat.id);
                      setShowAddCategory(false);
                      setNewCategoryName('');
                    } catch (err) {
                      alert(err instanceof Error ? err.message : 'Error al crear');
                    } finally {
                      setCreatingCategory(false);
                    }
                  }}
                >
                  Guardar
                </button>
                <button
                  type="button"
                  className="button button--ghost button--small"
                  onClick={() => setShowAddCategory(false)}
                  disabled={creatingCategory}
                >
                  ✕
                </button>
              </div>
            ) : (
              <select
                className="field__input"
                value={categoryId}
                onChange={event => setCategoryId(event.target.value)}
              >
                <option value="">Sin categoría</option>
                {categories
                  .filter(c => c.type === type && c.groupId === null)
                  .map(c => (
                    <option key={c.id} value={c.id}>
                      {c.icon ? `${c.icon} ` : ''}{c.name}
                    </option>
                  ))}
              </select>
            )}
          </label>

          <label className="field">
            <span className="field__label">Nota</span>
            <input
              className="field__input"
              type="text"
              placeholder="Opcional"
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

      <SectionCard title="Historial">
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
          <EmptyState title="No hay movimientos en este filtro" description="Prueba otro filtro." />
        ) : (
          <div className="list-stack">
            {filteredTransactions.map(transaction => {
              const amountValue = Number(transaction.amount) || 0;
              const sourceLabel =
                transaction.sourceType === 'group_expense'
                  ? `Grupo · ${transaction.groupName || 'Gasto compartido'}`
                  : transaction.sourceType === 'group_settlement_paid' || transaction.sourceType === 'group_settlement_received'
                    ? `Liquidación · ${transaction.groupName || 'Grupo'}`
                    : 'Manual';

              return (
                <article key={transaction.id} className={`list-row list-row--stacked ${editingId === transaction.id ? 'list-row--editing' : ''}`}>
                  {editingId === transaction.id ? (
                    <form
                      className="form-stack form-stack--inline"
                      onSubmit={async event => {
                        event.preventDefault();
                        try {
                          await onUpdateTransaction({
                            id: transaction.id,
                            type: editType,
                            amount: Number(editAmount),
                            categoryId: editCategoryId || null,
                            note: editNote || null,
                            occurredAt: new Date(editOccurredAt).toISOString(),
                          });
                          cancelEditing();
                        } catch (err) {
                          alert(err instanceof Error ? err.message : 'Error al actualizar');
                        }
                      }}
                    >
                      <div className="segmented-control">
                        <button
                          type="button"
                          className={`segmented-control__item ${editType === 'expense' ? 'segmented-control__item--active' : ''}`}
                          onClick={() => setEditType('expense')}
                        >
                          Gasto
                        </button>
                        <button
                          type="button"
                          className={`segmented-control__item ${editType === 'income' ? 'segmented-control__item--active' : ''}`}
                          onClick={() => setEditType('income')}
                        >
                          Ingreso
                        </button>
                      </div>
                      <label className="field field--amount">
                        <span className="field__label">Monto</span>
                        <input
                          className="field__input field__input--amount"
                          type="number"
                          inputMode="decimal"
                          step="0.01"
                          placeholder="0.00"
                          value={editAmount}
                          onChange={e => setEditAmount(e.target.value)}
                        />
                      </label>
                      <label className="field">
                        <span className="field__label">Categoría</span>
                        <select
                          className="field__input"
                          value={editCategoryId}
                          onChange={e => setEditCategoryId(e.target.value)}
                        >
                          <option value="">Sin categoría</option>
                          {categories
                            .filter(c => c.type === editType && c.groupId === null)
                            .map(c => (
                              <option key={c.id} value={c.id}>
                                {c.icon ? `${c.icon} ` : ''}{c.name}
                              </option>
                            ))}
                        </select>
                      </label>
                      <label className="field">
                        <span className="field__label">Nota</span>
                        <input
                          className="field__input"
                          type="text"
                          placeholder="Opcional"
                          value={editNote}
                          onChange={e => setEditNote(e.target.value)}
                        />
                      </label>
                      <label className="field">
                        <span className="field__label">Fecha</span>
                        <input
                          className="field__input"
                          type="datetime-local"
                          value={editOccurredAt}
                          onChange={e => setEditOccurredAt(e.target.value)}
                        />
                      </label>
                      <div className="inline-actions">
                        <button type="submit" className="button button--primary button--small">Guardar</button>
                        <button type="button" className="button button--ghost button--small" onClick={cancelEditing}>Cancelar</button>
                      </div>
                    </form>
                  ) : (
                    <>
                      <div className="list-row__content">
                        <div className="list-row__title">
                          {transaction.category ? (
                            <span className="category-tag">
                              {transaction.category.icon ? `${transaction.category.icon} ` : ''}
                              {transaction.category.name}
                            </span>
                          ) : (
                            transaction.type === 'income' ? 'Ingreso' : 'Gasto'
                          )}
                        </div>
                        <div className="list-row__meta">
                          {formatDate(transaction.occurredAt)} · {sourceLabel}
                        </div>
                        {transaction.note ? <div className="list-row__note">{transaction.note}</div> : null}
                      </div>
                      <div className="list-actions">
                        {transaction.locked ? <div className="chip">Grupo</div> : (
                          <>
                            <button
                              type="button"
                              className="button button--ghost button--small"
                              onClick={() => startEditing(transaction)}
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              className="button button--ghost button--small button--danger"
                              onClick={async () => {
                                if (!confirm('¿Eliminar este movimiento?')) return;
                                try {
                                  await onDeleteTransaction(transaction.id);
                                } catch (err) {
                                  alert(err instanceof Error ? err.message : 'Error al eliminar');
                                }
                              }}
                            >
                              Eliminar
                            </button>
                          </>
                        )}
                        <div className={`amount-pill ${transaction.type === 'income' ? 'amount-pill--positive' : 'amount-pill--negative'}`}>
                          {transaction.type === 'income' ? '+' : '-'}
                          {formatMoney(amountValue, user.currency)}
                        </div>
                      </div>
                    </>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </SectionCard>
    </div>
  );
};
