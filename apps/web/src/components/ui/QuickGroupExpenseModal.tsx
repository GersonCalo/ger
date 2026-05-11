import { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/hooks/useToast';
import { formatMoney } from '@/lib/format';
import type { GroupSummary, Category, AuthUser, GroupExpenseSplitInput } from '@/types';

const toCents = (amount: number) => Math.round(amount * 100);
const fromCents = (amount: number) => Number((amount / 100).toFixed(2));

const parseMoneyInput = (value: string) => {
  const normalized = value.replace(',', '.').trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

type QuickGroupExpenseModalProps = {
  isOpen: boolean;
  onClose: () => void;
  groups: GroupSummary[];
  categories: Category[];
  user: AuthUser;
  onAddExpense: (input: {
    groupId: string;
    description: string;
    amount: number;
    payerMemberId: string;
    categoryId?: string;
    splitMethod: 'equal' | 'manual' | 'weights';
    splits?: GroupExpenseSplitInput[];
    occurredAt: string;
  }) => Promise<void>;
};

type SplitMember = {
  id: string;
  displayName: string;
  selected: boolean;
  shareValue: string;
};

export const QuickGroupExpenseModal = ({
  isOpen,
  onClose,
  groups,
  categories,
  user,
  onAddExpense,
}: QuickGroupExpenseModalProps) => {
  const { showToast } = useToast();
  const [step, setStep] = useState<1 | 2>(1);
  const [busy, setBusy] = useState(false);

  const [groupId, setGroupId] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('');

  const [payerMemberId, setPayerMemberId] = useState('');
  const [splitMethod, setSplitMethod] = useState<'equal' | 'manual'>('equal');
  const [splitMembers, setSplitMembers] = useState<SplitMember[]>([]);

  const selectedGroup = groups.find(g => g.id === groupId);
  const groupCategories = categories.filter(
    c => c.type === 'expense' && (c.groupId === null || c.groupId === groupId)
  );

  useEffect(() => {
    if (isOpen && !groupId && groups.length > 0) {
      setGroupId(groups[0].id);
    }
  }, [isOpen, groups, groupId]);

  useEffect(() => {
    if (selectedGroup) {
      const currentUserMember = selectedGroup.members.find(m => m.userId === user.id);
      const defaultPayer = currentUserMember?.id || selectedGroup.members[0]?.id || '';
      setPayerMemberId(current => current || defaultPayer);

      setSplitMembers(
        selectedGroup.members.map(m => ({
          id: m.id,
          displayName: m.displayName,
          selected: true,
          shareValue: '',
        }))
      );
    }
  }, [selectedGroup?.id, user.id]);

  const resetForm = () => {
    setDescription('');
    setAmount('');
    setCategoryId('');
    setPayerMemberId('');
    setSplitMethod('equal');
    setSplitMembers([]);
    setStep(1);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const canProceedToStep2 = () => {
    return groupId && description.trim() && amount && Number(amount) > 0;
  };

  const selectedParticipants = splitMembers.filter(m => m.selected);
  const amountValue = Number(amount) || 0;
  const amountCents = amountValue > 0 ? toCents(amountValue) : 0;

  const assignedCents = splitMembers.reduce((sum, m) => {
    if (!m.selected) return sum;
    const parsed = parseMoneyInput(m.shareValue);
    return sum + (parsed != null ? toCents(parsed) : 0);
  }, 0);

  const remainingCents = amountCents - assignedCents;

  const allSharesFilled = selectedParticipants.every(m => {
    const parsed = parseMoneyInput(m.shareValue);
    return parsed != null && parsed > 0;
  });

  const manualSplitIsValid =
    splitMethod === 'equal' ||
    (amountValue > 0 && selectedParticipants.length > 0 && allSharesFilled && remainingCents === 0);

  const canSubmit = () => {
    if (!payerMemberId) return false;
    if (selectedParticipants.length === 0) return false;
    if (splitMethod === 'manual' && !manualSplitIsValid) return false;
    return true;
  };

  const buildSplits = (): GroupExpenseSplitInput[] => {
    if (splitMethod === 'equal') {
      const participantCount = selectedParticipants.length;
      const baseShare = Math.floor(amountCents / participantCount);
      let remainder = amountCents - baseShare * participantCount;

      return splitMembers.map(m => {
        if (!m.selected) {
          return { memberId: m.id, shareAmount: 0 };
        }
        const shareCents = baseShare + (remainder > 0 ? 1 : 0);
        remainder = Math.max(0, remainder - 1);
        return { memberId: m.id, shareAmount: fromCents(shareCents) };
      });
    }

    return splitMembers.map(m => {
      if (!m.selected) {
        return { memberId: m.id, shareAmount: 0 };
      }
      const parsed = parseMoneyInput(m.shareValue);
      return { memberId: m.id, shareAmount: parsed || 0 };
    });
  };

  const handleSubmit = async () => {
    if (!canSubmit()) return;

    setBusy(true);
    try {
      const splits = buildSplits();

      await onAddExpense({
        groupId,
        description: description.trim(),
        amount: amountValue,
        payerMemberId,
        categoryId: categoryId || undefined,
        splitMethod: 'manual',
        splits,
        occurredAt: new Date().toISOString(),
      });
      showToast({ message: 'Gasto de grupo añadido', type: 'success' });
      resetForm();
      onClose();
    } catch (err) {
      showToast({ message: err instanceof Error ? err.message : 'Error al crear el gasto', type: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const toggleParticipant = (id: string) => {
    setSplitMembers(prev =>
      prev.map(m => (m.id === id ? { ...m, selected: !m.selected } : m))
    );
  };

  const updateShareValue = (id: string, value: string) => {
    setSplitMembers(prev =>
      prev.map(m => (m.id === id ? { ...m, shareValue: value } : m))
    );
  };

  const applyRemainingToLast = () => {
    if (selectedParticipants.length === 0 || amountValue <= 0) return;
    const target = selectedParticipants[selectedParticipants.length - 1];
    const otherCents = splitMembers.reduce((sum, m) => {
      if (m.id === target.id || !m.selected) return sum;
      const parsed = parseMoneyInput(m.shareValue);
      return sum + (parsed != null ? toCents(parsed) : 0);
    }, 0);
    const remaining = amountCents - otherCents;
    updateShareValue(target.id, remaining > 0 ? String(fromCents(remaining)) : '');
  };

  const handleNext = () => {
    if (canProceedToStep2()) {
      setStep(2);
    }
  };

  const handleBack = () => {
    setStep(1);
  };

  if (groups.length === 0) {
    return (
      <Modal isOpen={isOpen} onClose={onClose} title="Nuevo gasto de grupo" size="md">
        <div className="empty-state">
          <div className="empty-state__glyph">✦</div>
          <div className="empty-state__title">No perteneces a ningún grupo</div>
          <div className="empty-state__description">Crea o únete a un grupo primero.</div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Nuevo gasto de grupo" size="md">
      <div className="modal-steps">
        <div className="modal-steps__bar">
          <div className={`modal-steps__indicator ${step >= 1 ? 'modal-steps__indicator--active' : ''}`} />
          <div className={`modal-steps__indicator ${step >= 2 ? 'modal-steps__indicator--active' : ''}`} />
          <div className={`modal-steps__indicator ${step >= 3 ? 'modal-steps__indicator--active' : ''}`} />
        </div>
        <div className="modal-steps__label">
          Paso {step} de 2
        </div>
      </div>

      {step === 1 && (
        <div className="form-stack">
          <label className="field">
            <span className="field__label">Grupo</span>
            <select
              className="field__input"
              value={groupId}
              onChange={e => {
                setGroupId(e.target.value);
                setCategoryId('');
                setPayerMemberId('');
              }}
            >
              {groups.map(g => (
                <option key={g.id} value={g.id}>
                  {g.name} ({g.currency})
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span className="field__label">Concepto</span>
            <input
              className="field__input"
              type="text"
              placeholder="Supermercado, gasolina..."
              value={description}
              onChange={e => setDescription(e.target.value)}
            />
          </label>

          <label className="field field--amount">
            <span className="field__label">Monto</span>
            <input
              className="field__input field__input--amount"
              type="number"
              inputMode="decimal"
              step="0.01"
              placeholder="0.00"
              value={amount}
              onChange={e => setAmount(e.target.value)}
            />
          </label>

          {selectedGroup && (
            <label className="field">
              <span className="field__label">Categoría</span>
              <select
                className="field__input"
                value={categoryId}
                onChange={e => setCategoryId(e.target.value)}
              >
                <option value="">Sin categoría</option>
                {groupCategories.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.icon ? `${c.icon} ` : ''}{c.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          <button
            type="button"
            className="button button--primary"
            disabled={!canProceedToStep2()}
            onClick={handleNext}
          >
            Siguiente
          </button>
        </div>
      )}

      {step === 2 && selectedGroup && (
        <div className="form-stack">
          <label className="field">
            <span className="field__label">Pagó</span>
            <select
              className="field__input"
              value={payerMemberId}
              onChange={e => setPayerMemberId(e.target.value)}
            >
              {selectedGroup.members.map(m => (
                <option key={m.id} value={m.id}>
                  {m.displayName}
                </option>
              ))}
            </select>
          </label>

          <div className="field">
            <span className="field__label">Entre quiénes</span>
            <div className="split-members">
              {splitMembers.map(m => (
                <label key={m.id} className="split-members__item">
                  <input
                    type="checkbox"
                    checked={m.selected}
                    onChange={() => toggleParticipant(m.id)}
                  />
                  <span>{m.displayName}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="segmented-control">
            <button
              type="button"
              className={`segmented-control__item ${splitMethod === 'equal' ? 'segmented-control__item--active' : ''}`}
              onClick={() => setSplitMethod('equal')}
            >
              Equitativo
            </button>
            <button
              type="button"
              className={`segmented-control__item ${splitMethod === 'manual' ? 'segmented-control__item--active' : ''}`}
              onClick={() => setSplitMethod('manual')}
            >
              Personalizado
            </button>
          </div>

          {splitMethod === 'manual' && selectedParticipants.length > 0 && (
            <div className="form-stack">
              <div className="section-split">
                {splitMembers.filter(m => m.selected).map(m => (
                  <label key={m.id} className="field">
                    <span className="field__label">{m.displayName}</span>
                    <input
                      className="field__input"
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      placeholder="0.00"
                      value={m.shareValue}
                      onChange={e => updateShareValue(m.id, e.target.value)}
                    />
                  </label>
                ))}
              </div>

              <div className="split-summary">
                <div className="split-summary__title">Reparto</div>
                <div className="split-summary__meta">
                  Total {formatMoney(amountValue || 0, selectedGroup.currency)} · Asignado{' '}
                  {formatMoney(fromCents(assignedCents), selectedGroup.currency)} · Restante{' '}
                  {formatMoney(fromCents(remainingCents), selectedGroup.currency)}
                </div>
                <button
                  type="button"
                  className="button button--ghost button--small"
                  onClick={applyRemainingToLast}
                >
                  Completar resto
                </button>
              </div>
            </div>
          )}

          {splitMethod === 'equal' && selectedParticipants.length > 0 && (
            <div className="split-summary">
              <div className="split-summary__title">Reparto equitativo</div>
              <div className="split-summary__meta">
                {selectedParticipants.length} participantes ·{' '}
                {amountValue > 0
                  ? `${formatMoney(amountValue / selectedParticipants.length, selectedGroup.currency)} por persona`
                  : '—'}
              </div>
            </div>
          )}

          <div className="form-actions">
            <button
              type="button"
              className="button button--ghost"
              onClick={handleBack}
            >
              Atrás
            </button>
            <button
              type="button"
              className="button button--primary"
              disabled={!canSubmit() || busy}
              onClick={handleSubmit}
            >
              {busy ? 'Guardando...' : 'Añadir gasto'}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
};
