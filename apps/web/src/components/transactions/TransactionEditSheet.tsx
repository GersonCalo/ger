import { useCallback, useEffect, useRef, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/hooks/useToast';
import { formatDate } from '@/lib/format';
import {
  createInitialValues,
  fromTransaction,
  isDirty,
  validateAmount,
  validateOccurredAt,
  type TransactionFormValues,
} from '@/lib/transactionForm';
import type { Transaction, Category } from '@/types';

type TransactionEditSheetProps = {
  isOpen: boolean;
  transaction: Transaction | null;
  categories: Category[];
  busy: boolean;
  onSave: (input: {
    id: string;
    type: 'income' | 'expense';
    amount: number;
    categoryId: string | null;
    note: string | null;
    occurredAt: string;
  }) => Promise<void>;
  onClose: () => void;
};

export const TransactionEditSheet = ({
  isOpen,
  transaction,
  categories,
  busy,
  onSave,
  onClose,
}: TransactionEditSheetProps) => {
  const { showToast } = useToast();
  const [values, setValues] = useState<TransactionFormValues>(createInitialValues());
  const [initialSnapshot, setInitialSnapshot] = useState<TransactionFormValues>(createInitialValues());
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const invokerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (isOpen && transaction) {
      invokerRef.current = document.activeElement as HTMLElement;
      const vals = fromTransaction(transaction);
      setValues(vals);
      setInitialSnapshot(vals);
      setLocalError(null);
      setShowDiscardConfirm(false);
    }
  }, [isOpen, transaction]);

  const hasChanges = isDirty(values, initialSnapshot);

  const update = useCallback(
    (patch: Partial<TransactionFormValues>) => {
      setValues(prev => ({ ...prev, ...patch }));
    },
    []
  );

  const handleTypeChange = useCallback(
    (type: 'income' | 'expense') => {
      setValues(prev => {
        const next = { ...prev, type };
        if (prev.categoryId) {
          const catStillValid = categories.some(
            c => c.id === prev.categoryId && c.type === type && c.groupId === null
          );
          if (!catStillValid) {
            next.categoryId = '';
          }
        }
        return next;
      });
    },
    [categories]
  );

  const attemptClose = useCallback(() => {
    if (hasChanges) {
      setShowDiscardConfirm(true);
    } else {
      onClose();
    }
  }, [hasChanges, onClose]);

  const handleDiscard = useCallback(() => {
    setShowDiscardConfirm(false);
    onClose();
  }, [onClose]);

  const handleCancelDiscard = useCallback(() => {
    setShowDiscardConfirm(false);
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setLocalError(null);

      if (!transaction) return;
      if (!validateAmount(values.amount)) {
        setLocalError('Ingresa un monto válido mayor a 0');
        return;
      }
      if (!validateOccurredAt(values.occurredAt)) {
        setLocalError('Ingresa una fecha válida');
        return;
      }

      try {
        await onSave({
          id: transaction.id,
          type: values.type,
          amount: Number(values.amount),
          categoryId: values.categoryId || null,
          note: values.note.trim() || null,
          occurredAt: new Date(values.occurredAt).toISOString(),
        });
        showToast({ message: 'Movimiento actualizado', type: 'success' });
        onClose();
      } catch (err) {
        showToast({
          message: err instanceof Error ? err.message : 'No se pudo actualizar el movimiento',
          type: 'error',
        });
      }
    },
    [transaction, values, onSave, showToast, onClose]
  );

  const filteredCategories = categories.filter(
    c => c.type === values.type && c.groupId === null
  );

  return (
    <>
      <Modal
        isOpen={isOpen && !showDiscardConfirm}
        onClose={attemptClose}
        title="Editar movimiento"
        size="md"
      >
        {!transaction ? null : (
          <form className="form-stack edit-tx-form" onSubmit={handleSubmit}>
            <div className="segmented-control">
              <button
                type="button"
                className={`segmented-control__item ${values.type === 'expense' ? 'segmented-control__item--active' : ''}`}
                onClick={() => handleTypeChange('expense')}
              >
                Gasto
              </button>
              <button
                type="button"
                className={`segmented-control__item ${values.type === 'income' ? 'segmented-control__item--active' : ''}`}
                onClick={() => handleTypeChange('income')}
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
                value={values.amount}
                onChange={e => update({ amount: e.target.value })}
              />
            </label>

            <label className="field">
              <span className="field__label">Categoría</span>
              <select
                className="field__input"
                value={values.categoryId}
                onChange={e => update({ categoryId: e.target.value })}
              >
                <option value="">Sin categoría</option>
                {filteredCategories.map(c => (
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
                value={values.note}
                onChange={e => update({ note: e.target.value })}
              />
            </label>

            <label className="field">
              <span className="field__label">Fecha</span>
              <input
                className="field__input"
                type="datetime-local"
                value={values.occurredAt}
                onChange={e => update({ occurredAt: e.target.value })}
              />
            </label>

            {localError && <div className="form-error">{localError}</div>}

            <div className="edit-tx-actions">
              <button type="submit" className="button button--primary" disabled={busy || !validateAmount(values.amount)}>
                {busy ? 'Guardando...' : 'Guardar cambios'}
              </button>
              <button type="button" className="button button--ghost" onClick={attemptClose}>
                Cancelar
              </button>
            </div>
          </form>
        )}
      </Modal>

      <Modal
        isOpen={showDiscardConfirm}
        onClose={handleCancelDiscard}
        title="Descartar cambios"
        size="sm"
      >
        <div className="discard-confirm">
          <p className="discard-confirm__text">
            Tienes cambios sin guardar. ¿Seguro que quieres descartarlos?
          </p>
          <div className="discard-confirm__actions">
            <button
              type="button"
              className="button button--danger"
              onClick={handleDiscard}
            >
              Descartar
            </button>
            <button
              type="button"
              className="button button--ghost"
              onClick={handleCancelDiscard}
            >
              Continuar editando
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
};
