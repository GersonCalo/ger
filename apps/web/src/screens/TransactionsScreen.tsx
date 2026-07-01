import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { EmptyState } from '@/components/EmptyState';
import { SectionCard } from '@/components/SectionCard';
import { StatCard } from '@/components/StatCard';
import { Modal } from '@/components/ui/Modal';
import { TransactionEditSheet } from '@/components/transactions/TransactionEditSheet';
import { SwipeableTransactionRow } from '@/components/transactions/SwipeableTransactionRow';
import { formatDate, formatMoney } from '@/lib/format';
import { useToast } from '@/hooks/useToast';
import { useFabBlockedState } from '@/routes/DashboardLayout';
import { isPushEnabled, isPushSupported } from '@/lib/push';
import type { AuthUser, BudgetAlertTriggered, Transaction, Category, TransactionListFilters } from '@/types';

const ACTIONS_WIDTH = 140;

type TransactionsScreenProps = {
  busy: boolean;
  error: string | null;
  onCreateTransaction: (input: { type: 'income' | 'expense'; amount: number; categoryId?: string; note?: string; occurredAt: string }) => Promise<{ alertsTriggered: BudgetAlertTriggered[] }>;
  onUpdateTransaction: (input: { id: string; type?: 'income' | 'expense'; amount?: number; categoryId?: string | null; note?: string | null; occurredAt?: string }) => Promise<{ alertsTriggered: BudgetAlertTriggered[] }>;
  onDeleteTransaction: (id: string) => Promise<void>;
  onCreateCategory: (input: { name: string; type: 'income' | 'expense'; color?: string; icon?: string }) => Promise<any>;
  onRefresh: () => Promise<void>;
  onApplyFilters: (filters: TransactionListFilters) => Promise<void>;
  onLoadMore: () => Promise<void>;
  onExportCsv: () => Promise<void>;
  summary: {
    balance: number;
    income: number;
    expense: number;
  };
  transactions: Transaction[];
  user: AuthUser;
  categories: Category[];
  filters: TransactionListFilters;
  hasMore: boolean;
  loadingMore: boolean;
};

export const TransactionsScreen = ({
  busy,
  error,
  onCreateTransaction,
  onUpdateTransaction,
  onDeleteTransaction,
  onCreateCategory,
  onRefresh,
  onApplyFilters,
  onLoadMore,
  onExportCsv,
  summary,
  transactions,
  user,
  categories,
  filters,
  hasMore,
  loadingMore,
}: TransactionsScreenProps) => {
  const { showToast } = useToast();
  const location = useLocation();
  const { setFabBlockedState } = useFabBlockedState();
  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [note, setNote] = useState('');
  const [justAdded, setJustAdded] = useState(false);

  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [creatingCategory, setCreatingCategory] = useState(false);

  const [editTransaction, setEditTransaction] = useState<Transaction | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);

  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>(filters?.type ?? 'all');
  const [filterOrigin, setFilterOrigin] = useState<'all' | 'manual' | 'group'>(filters?.origin ?? 'all');
  const [filterFrom, setFilterFrom] = useState(filters?.from ? filters.from.slice(0, 16) : '');
  const [filterTo, setFilterTo] = useState(filters?.to ? filters.to.slice(0, 16) : '');

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const [openSwipeRowId, setOpenSwipeRowId] = useState<string | null>(null);
  const [deleteConfirmTx, setDeleteConfirmTx] = useState<Transaction | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const successTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const state = location.state as { openCreateModal?: boolean } | null;
    if (state?.openCreateModal) {
      setIsCreateModalOpen(true);
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  useEffect(() => {
    setFabBlockedState({
      isTransactionCreateOpen: isCreateModalOpen,
      isTransactionEditOpen: isEditOpen,
      isTransactionDeleteConfirmOpen: !!deleteConfirmTx,
    });
  }, [isCreateModalOpen, isEditOpen, deleteConfirmTx, setFabBlockedState]);

  const handleApplyFilters = () => {
    const newFilters: TransactionListFilters = {};
    if (filterType !== 'all') newFilters.type = filterType;
    if (filterOrigin !== 'all') newFilters.origin = filterOrigin;
    if (filterFrom) newFilters.from = new Date(filterFrom).toISOString();
    if (filterTo) newFilters.to = new Date(filterTo).toISOString();
    onApplyFilters(newFilters);
  };

  const hasActiveFilters = filterType !== 'all' || filterOrigin !== 'all' || Boolean(filterFrom) || Boolean(filterTo);

  const clearFiltersAndRefresh = async () => {
    setFilterType('all');
    setFilterOrigin('all');
    setFilterFrom('');
    setFilterTo('');
    await onApplyFilters({});
  };

  const openEdit = (transaction: Transaction) => {
    setOpenSwipeRowId(null);
    setEditTransaction(transaction);
    setIsEditOpen(true);
  };

  const closeEdit = () => {
    setIsEditOpen(false);
    setEditTransaction(null);
  };

  const openDeleteConfirm = (transaction: Transaction) => {
    setOpenSwipeRowId(null);
    setDeleteConfirmTx(transaction);
  };

  const closeDeleteConfirm = () => {
    setDeleteConfirmTx(null);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirmTx) return;
    setIsDeleting(true);
    try {
      await onDeleteTransaction(deleteConfirmTx.id);
      showToast({ message: 'Movimiento eliminado', type: 'success' });
    } catch (err) {
      showToast({ message: err instanceof Error ? err.message : 'No se pudo eliminar el movimiento', type: 'error' });
    } finally {
      setIsDeleting(false);
      setDeleteConfirmTx(null);
    }
  };

  const handleSwipeOpen = (id: string) => {
    setOpenSwipeRowId(id);
  };

  const handleSwipeClose = () => {
    setOpenSwipeRowId(null);
  };

  const resetCreateForm = () => {
    setAmount('');
    setCategoryId('');
    setNote('');
    setShowAddCategory(false);
    setNewCategoryName('');
  };

  const showBudgetAlertFallback = (alerts: BudgetAlertTriggered[]) => {
    if (alerts.length === 0 || isPushSupported() && isPushEnabled()) return;
    for (const alert of alerts) {
      const label = alert.threshold === 80 ? 'Cerca del límite' : 'Presupuesto excedido';
      showToast({
        message: `${label}: ${alert.categoryName} (${Math.round(alert.consumedPercent)}%)`,
        type: alert.threshold === 100 ? 'error' : 'info',
        duration: 5000,
      });
    }
  };

  const handleEditSave = async (input: { id: string; type?: 'income' | 'expense'; amount?: number; categoryId?: string | null; note?: string | null; occurredAt?: string }) => {
    const result = await onUpdateTransaction(input);
    showBudgetAlertFallback(result?.alertsTriggered ?? []);
  };

  const nowUtcNoon = () => {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 12, 0, 0, 0)).toISOString();
  };

  const handleCreateSubmit = async () => {
    if (!amount) return;

    const result = await onCreateTransaction({
      type,
      amount: Number(amount),
      categoryId: categoryId || undefined,
      note: note || undefined,
      occurredAt: nowUtcNoon(),
    });

    showToast({ message: 'Movimiento registrado', type: 'success' });
    showBudgetAlertFallback(result?.alertsTriggered ?? []);

    if (successTimerRef.current) {
      window.clearTimeout(successTimerRef.current);
    }

    setJustAdded(true);
    successTimerRef.current = window.setTimeout(() => setJustAdded(false), 1400);
    resetCreateForm();
    setIsCreateModalOpen(false);
  };

  const createFormContent = (
    <>
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
          await handleCreateSubmit();
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
                    showToast({ message: err instanceof Error ? err.message : 'No se pudo crear la categoría', type: 'error' });
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
    </>
  );

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

      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => {
          resetCreateForm();
          setIsCreateModalOpen(false);
        }}
        title="Nuevo movimiento"
        size="md"
      >
        {createFormContent}
      </Modal>

      <Modal
        isOpen={!!deleteConfirmTx}
        onClose={closeDeleteConfirm}
        title="Eliminar movimiento"
        size="sm"
      >
        <div className="delete-confirm">
          <p className="delete-confirm__text">
            ¿Estás seguro de que quieres eliminar este movimiento? Esta acción no se puede deshacer.
          </p>
          <div className="delete-confirm__actions">
            <button
              type="button"
              className="button button--ghost"
              onClick={closeDeleteConfirm}
              disabled={isDeleting}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="button button--danger"
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
            >
              {isDeleting ? 'Eliminando...' : 'Eliminar'}
            </button>
          </div>
        </div>
      </Modal>

      <SectionCard title="Historial">
        <div className="filters-stack">
          <div className="segmented-control segmented-control--triple">
            <button
              type="button"
              className={`segmented-control__item ${filterType === 'all' ? 'segmented-control__item--active' : ''}`}
              onClick={() => setFilterType('all')}
            >
              Todo
            </button>
            <button
              type="button"
              className={`segmented-control__item ${filterType === 'income' ? 'segmented-control__item--active' : ''}`}
              onClick={() => setFilterType('income')}
            >
              Ingresos
            </button>
            <button
              type="button"
              className={`segmented-control__item ${filterType === 'expense' ? 'segmented-control__item--active' : ''}`}
              onClick={() => setFilterType('expense')}
            >
              Gastos
            </button>
          </div>

          <div className="segmented-control">
            <button
              type="button"
              className={`segmented-control__item ${filterOrigin === 'all' ? 'segmented-control__item--active' : ''}`}
              onClick={() => setFilterOrigin('all')}
            >
              Todo origen
            </button>
            <button
              type="button"
              className={`segmented-control__item ${filterOrigin === 'manual' ? 'segmented-control__item--active' : ''}`}
              onClick={() => setFilterOrigin('manual')}
            >
              Manual
            </button>
            <button
              type="button"
              className={`segmented-control__item ${filterOrigin === 'group' ? 'segmented-control__item--active' : ''}`}
              onClick={() => setFilterOrigin('group')}
            >
              Grupo
            </button>
          </div>

          <div className="date-filters">
            <label className="field">
              <span className="field__label">Desde</span>
              <input
                className="field__input"
                type="datetime-local"
                value={filterFrom}
                onChange={e => setFilterFrom(e.target.value)}
              />
            </label>
            <label className="field">
              <span className="field__label">Hasta</span>
              <input
                className="field__input"
                type="datetime-local"
                value={filterTo}
                onChange={e => setFilterTo(e.target.value)}
              />
            </label>
          </div>

          <div className="inline-actions">
            <button
              type="button"
              className="button button--primary button--small"
              onClick={handleApplyFilters}
              disabled={busy}
            >
              Aplicar filtros
            </button>
            {hasActiveFilters && (
              <button
                type="button"
                className="button button--ghost button--small"
                onClick={clearFiltersAndRefresh}
                disabled={busy}
              >
                Limpiar
              </button>
            )}
          </div>
        </div>

        <div className="export-bar">
          <button
            type="button"
            className="button button--ghost button--small"
            onClick={onExportCsv}
            disabled={busy}
          >
            Exportar CSV
          </button>
        </div>

        {transactions.length === 0 ? (
          <EmptyState
            title={hasActiveFilters ? 'Sin resultados' : 'No hay movimientos'}
            description={hasActiveFilters ? 'Prueba otros filtros.' : 'Pulsa + para crear el primero.'}
          />
        ) : (
          <div className="list-stack">
            {transactions.map(transaction => {
              const amountValue = Number(transaction.amount) || 0;
              const sourceLabel =
                transaction.sourceType === 'group_expense'
                  ? `Grupo · ${transaction.groupName || 'Gasto compartido'}`
                  : transaction.sourceType === 'group_settlement_paid' || transaction.sourceType === 'group_settlement_received'
                    ? `Liquidación · ${transaction.groupName || 'Grupo'}`
                    : 'Manual';

              const isOpen = openSwipeRowId === transaction.id;

              const rowContent = (
                <article className="list-row list-row--stacked">
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
                          onClick={() => openEdit(transaction)}
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          className="button button--ghost button--small button--danger"
                          onClick={() => openDeleteConfirm(transaction)}
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
                </article>
              );

              return (
                <SwipeableTransactionRow
                  key={transaction.id}
                  id={transaction.id}
                  isOpen={isOpen}
                  onOpen={handleSwipeOpen}
                  onClose={handleSwipeClose}
                  actionsWidth={ACTIONS_WIDTH}
                  actions={
                    transaction.locked ? null : (
                      <div className="swipeable-actions">
                        <button
                          type="button"
                          className="swipeable-action swipeable-action--edit"
                          onClick={() => openEdit(transaction)}
                          aria-label="Editar movimiento"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          className="swipeable-action swipeable-action--delete"
                          onClick={() => openDeleteConfirm(transaction)}
                          aria-label="Eliminar movimiento"
                        >
                          Eliminar
                        </button>
                      </div>
                    )
                  }
                >
                  {rowContent}
                </SwipeableTransactionRow>
              );
            })}

            {hasMore && (
              <div className="load-more">
                <button
                  type="button"
                  className="button button--ghost"
                  onClick={onLoadMore}
                  disabled={loadingMore}
                >
                  {loadingMore ? 'Cargando...' : 'Cargar más'}
                </button>
              </div>
            )}
          </div>
        )}
      </SectionCard>

      <TransactionEditSheet
        isOpen={isEditOpen}
        transaction={editTransaction}
        categories={categories}
        busy={busy}
        onSave={handleEditSave}
        onClose={closeEdit}
      />
    </div>
  );
};
