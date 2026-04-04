import { useEffect, useMemo, useState } from 'react';
import { EmptyState } from '@/components/EmptyState';
import { SectionCard } from '@/components/SectionCard';
import { StatCard } from '@/components/StatCard';
import { formatDate, formatMoney } from '@/lib/format';
import { summarizeTransactions } from '@/lib/groups';
import type { AuthUser, GroupBalancesPayload, GroupExpense, GroupExpenseSplitInput, GroupSummary } from '@/types';

type GroupsScreenProps = {
  error: string | null;
  groups: GroupSummary[];
  groupsBusy: boolean;
  notice: string;
  onAddMember: (input: { groupId: string; displayName: string }) => Promise<void>;
  onAddExpense: (input: {
    groupId: string;
    description: string;
    amount: number;
    payerMemberId: string;
    splitMethod: 'equal' | 'manual';
    splits?: GroupExpenseSplitInput[];
  }) => Promise<void>;
  onCreateGroup: (input: { name: string; guestMembers: string[] }) => Promise<void>;
  onCreateSettlement: (input: { groupId: string; fromMemberId: string; toMemberId: string; amount: number }) => Promise<void>;
  onJoinByCode: (code: string) => Promise<void>;
  onSelectGroup: (groupId: string) => void;
  onUpdateExpense: (input: {
    expenseId: string;
    groupId: string;
    description: string;
    amount: number;
    payerMemberId: string;
    splitMethod: 'equal' | 'manual';
    splits?: GroupExpenseSplitInput[];
  }) => Promise<void>;
  selectedGroupData: GroupBalancesPayload | null;
  selectedGroupId: string | null;
  selectedGroupJoinCode: string | null;
  user: AuthUser;
};

const toCents = (amount: number) => Math.round(amount * 100);
const fromCents = (amount: number) => Number((amount / 100).toFixed(2));

const parseMoneyInput = (value: string) => {
  const normalizedValue = value.replace(',', '.').trim();
  if (!normalizedValue) return null;
  const parsed = Number(normalizedValue);
  return Number.isFinite(parsed) ? parsed : null;
};

const buildManualShareState = (
  members: Array<{ id: string }>,
  expense?: Pick<GroupExpense, 'splits'>
) =>
  Object.fromEntries(
    members.map(member => {
      const split = expense?.splits.find(item => item.memberId === member.id);
      return [member.id, split?.shareAmount != null ? String(split.shareAmount) : ''];
    })
  ) as Record<string, string>;

export const GroupsScreen = ({
  error,
  groups,
  groupsBusy,
  notice,
  onAddExpense,
  onAddMember,
  onCreateGroup,
  onCreateSettlement,
  onJoinByCode,
  onSelectGroup,
  onUpdateExpense,
  selectedGroupData,
  selectedGroupId,
  selectedGroupJoinCode,
  user,
}: GroupsScreenProps) => {
  const [view, setView] = useState<'list' | 'detail'>('list');
  const [showGroupActions, setShowGroupActions] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [guestMembers, setGuestMembers] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [memberName, setMemberName] = useState('');
  const [expenseDescription, setExpenseDescription] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [payerMemberId, setPayerMemberId] = useState('');
  const [splitMethod, setSplitMethod] = useState<'equal' | 'manual'>('equal');
  const [manualShares, setManualShares] = useState<Record<string, string>>({});
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [settlementAmount, setSettlementAmount] = useState('');
  const [settlementFromId, setSettlementFromId] = useState('');
  const [settlementToId, setSettlementToId] = useState('');

  const selectedGroup = useMemo(() => groups.find(group => group.id === selectedGroupId) || null, [groups, selectedGroupId]);
  const summary = selectedGroup ? summarizeTransactions(selectedGroup) : { total: 0, count: 0 };
  const balances = selectedGroupData?.balances || [];
  const expenses = selectedGroupData?.expenses || selectedGroup?.expenses || [];
  const suggestions = selectedGroupData?.suggestions || [];
  const settlements = selectedGroupData?.settlements || [];
  const currentUserMember =
    selectedGroupData?.members.find(member => member.userId === user.id) ||
    selectedGroup?.members.find(member => member.userId === user.id) ||
    null;
  const currentUserBalance = balances.find(balance => balance.memberId === currentUserMember?.id) || null;
  const creditorBalances = balances.filter(balance => balance.net > 0 && balance.memberId !== currentUserMember?.id);
  const availableSettlementTargets = selectedGroupData?.members.filter(member =>
    creditorBalances.some(balance => balance.memberId === member.id)
  ) || [];
  const expenseAmountValue = parseMoneyInput(expenseAmount);
  const manualSplitDrafts = (selectedGroupData?.members || []).map(member => {
    const rawValue = manualShares[member.id] || '';
    const parsedValue = parseMoneyInput(rawValue);

    return {
      member,
      rawValue,
      parsedValue,
      cents: parsedValue != null ? toCents(parsedValue) : null,
    };
  });
  const manualAssignedCents = manualSplitDrafts.reduce((sum, split) => sum + (split.cents ?? 0), 0);
  const totalExpenseCents = expenseAmountValue != null && expenseAmountValue > 0 ? toCents(expenseAmountValue) : 0;
  const manualRemainingCents = totalExpenseCents - manualAssignedCents;
  const manualAllMembersFilled =
    manualSplitDrafts.length > 0 && manualSplitDrafts.every(split => split.parsedValue != null && split.parsedValue > 0);
  const manualSplitIsValid =
    splitMethod === 'equal' ||
    (expenseAmountValue != null &&
      expenseAmountValue > 0 &&
      manualAllMembersFilled &&
      manualRemainingCents === 0 &&
      manualSplitDrafts.length === (selectedGroupData?.members.length || 0));
  const editableExpenseIds = new Set(
    expenses
      .filter(expense => currentUserMember && (currentUserMember.role === 'admin' || currentUserMember.id === expense.payerMemberId))
      .map(expense => expense.id)
  );

  useEffect(() => {
    if (!groups.length) return;
    if (!selectedGroupId || !groups.some(group => group.id === selectedGroupId)) onSelectGroup(groups[0].id);
  }, [groups, onSelectGroup, selectedGroupId]);

  useEffect(() => {
    if (!selectedGroupData) return;

    setPayerMemberId(current => current || selectedGroupData.members[0]?.id || '');
    setManualShares(current => {
      const hasCurrentMembers = selectedGroupData.members.every(member => member.id in current);
      return hasCurrentMembers ? current : buildManualShareState(selectedGroupData.members);
    });
    setSettlementFromId(currentUserMember?.id || '');
    setSettlementToId(current => {
      if (
        current &&
        current !== currentUserMember?.id &&
        availableSettlementTargets.some(member => member.id === current)
      ) {
        return current;
      }

      const suggestedTargetId = suggestions.find(suggestion => suggestion.fromMemberId === currentUserMember?.id)?.toMemberId;
      return suggestedTargetId || availableSettlementTargets[0]?.id || '';
    });
  }, [availableSettlementTargets, currentUserMember?.id, selectedGroupData, suggestions]);

  useEffect(() => {
    if (!selectedGroupData) return;
    setEditingExpenseId(null);
    setExpenseDescription('');
    setExpenseAmount('');
    setSplitMethod('equal');
    setManualShares(buildManualShareState(selectedGroupData.members));
    setPayerMemberId(selectedGroupData.members[0]?.id || '');
  }, [selectedGroupData?.group.id]);

  useEffect(() => {
    if (!groups.length) {
      setView('list');
      setShowGroupActions(true);
    }
  }, [groups.length]);

  const resetExpenseForm = () => {
    setEditingExpenseId(null);
    setExpenseDescription('');
    setExpenseAmount('');
    setSplitMethod('equal');
    setManualShares(buildManualShareState(selectedGroupData?.members || selectedGroup?.members || []));
    setPayerMemberId(selectedGroupData?.members[0]?.id || selectedGroup?.members[0]?.id || '');
  };

  const applyRemainingToLastMember = () => {
    if (!selectedGroupData?.members.length || expenseAmountValue == null || expenseAmountValue <= 0) return;

    const targetMember = selectedGroupData.members[selectedGroupData.members.length - 1];
    const otherMembersCents = manualSplitDrafts.reduce((sum, split) => {
      if (split.member.id === targetMember.id) {
        return sum;
      }

      return sum + (split.cents ?? 0);
    }, 0);
    const remainingCents = totalExpenseCents - otherMembersCents;

    setManualShares(current => ({
      ...current,
      [targetMember.id]: remainingCents > 0 ? String(fromCents(remainingCents)) : current[targetMember.id] || '',
    }));
  };

  const startEditingExpense = (expense: GroupExpense) => {
    if (!selectedGroupData) return;

    setEditingExpenseId(expense.id);
    setExpenseDescription(expense.description || '');
    setExpenseAmount(String(expense.amount));
    setPayerMemberId(expense.payerMemberId);
    setSplitMethod(expense.splitMethod === 'equal' ? 'equal' : 'manual');
    setManualShares(buildManualShareState(selectedGroupData.members, expense));
  };

  const openGroupDetail = (groupId: string) => {
    onSelectGroup(groupId);
    setView('detail');
  };

  return (
    <div className="screen-stack">
      {view === 'list' ? (
        <>
          <section className="screen-intro">
            <div className="screen-intro__eyebrow">Vista general</div>
            <h2 className="screen-intro__title">Tus grupos, de un vistazo</h2>
            <p className="screen-intro__body">
              Entra solo al detalle que necesites. Crear un grupo o unirte por código queda disponible como acción secundaria.
            </p>
            <div className="screen-intro__actions">
              <button type="button" className="button button--primary button--small" onClick={() => setShowGroupActions(current => !current)}>
                {showGroupActions ? 'Ocultar acciones' : 'Crear o unirme'}
              </button>
            </div>
          </section>

          {showGroupActions ? (
            <SectionCard title="Acciones de grupos" subtitle="Crea un grupo nuevo o entra con un código existente.">
              <div className="section-split">
                <form
                  className="form-stack"
                  onSubmit={async event => {
                    event.preventDefault();
                    const members = guestMembers
                      .split(',')
                      .map(member => member.trim())
                      .filter(Boolean);

                    if (!groupName.trim()) return;

                    await onCreateGroup({ name: groupName.trim(), guestMembers: members });
                    setGroupName('');
                    setGuestMembers('');
                    setShowGroupActions(false);
                  }}
                >
                  <label className="field">
                    <span className="field__label">Nombre del grupo</span>
                    <input
                      className="field__input"
                      type="text"
                      placeholder="Piso, viaje, pareja..."
                      value={groupName}
                      onChange={event => setGroupName(event.target.value)}
                    />
                  </label>

                  <label className="field">
                    <span className="field__label">Invitados</span>
                    <input
                      className="field__input"
                      type="text"
                      placeholder="Lucía, Dani, Ana"
                      value={guestMembers}
                      onChange={event => setGuestMembers(event.target.value)}
                    />
                  </label>

                  <button type="submit" className="button button--primary">
                    {groupsBusy ? 'Guardando...' : 'Crear grupo'}
                  </button>
                </form>

                <form
                  className="form-stack"
                  onSubmit={async event => {
                    event.preventDefault();
                    if (!joinCode.trim()) return;
                    await onJoinByCode(joinCode.trim());
                    setJoinCode('');
                    setShowGroupActions(false);
                  }}
                >
                  <label className="field">
                    <span className="field__label">Código del grupo</span>
                    <input
                      className="field__input"
                      type="text"
                      placeholder="ABCD1234"
                      value={joinCode}
                      onChange={event => setJoinCode(event.target.value.toUpperCase())}
                    />
                  </label>

                  <button type="submit" className="button button--ghost">
                    {groupsBusy ? 'Uniendo...' : 'Unirme con código'}
                  </button>
                </form>
              </div>
            </SectionCard>
          ) : null}

          {groups.length === 0 ? (
            <SectionCard>
              <EmptyState
                title="Todavía no hay grupos"
                description="Empieza creando uno nuevo o usa un código para entrar en un grupo existente."
              />
            </SectionCard>
          ) : (
            <>
              <div className="stats-grid">
                <StatCard label="Tus grupos" value={`${groups.length}`} />
                <StatCard label="Total movimientos" value={`${groups.reduce((sum, group) => sum + group.expensesCount, 0)}`} />
              </div>

              <SectionCard title="Listado de grupos" subtitle={notice || 'Selecciona un grupo para abrir su detalle.'}>
                <div className="group-list">
                  {groups.map(group => {
                    const groupSummary = summarizeTransactions(group);

                    return (
                      <button key={group.id} type="button" className="group-card" onClick={() => openGroupDetail(group.id)}>
                        <div className="group-card__header">
                          <div>
                            <div className="group-card__name">{group.name}</div>
                            <div className="group-card__meta">
                              {group.membersCount} miembros · {group.expensesCount} gastos
                            </div>
                          </div>
                          <div className="amount-pill amount-pill--accent">{group.currency}</div>
                        </div>
                        <div className="group-card__stats">
                          <span>Total {formatMoney(groupSummary.total, group.currency)}</span>
                          <span>Actividad {groupSummary.count}</span>
                          <span>Creado {formatDate(group.createdAt)}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </SectionCard>
            </>
          )}
        </>
      ) : selectedGroup ? (
        <>
          <div className="detail-toolbar">
            <button type="button" className="button button--ghost button--small" onClick={() => setView('list')}>
              Volver a grupos
            </button>
            <button type="button" className="button button--ghost button--small" onClick={() => setShowGroupActions(current => !current)}>
              Acciones
            </button>
          </div>

          {showGroupActions ? (
            <SectionCard title="Acciones secundarias" subtitle="Crea otro grupo o entra en uno nuevo sin salir del detalle actual.">
              <div className="section-split">
                <form
                  className="form-stack"
                  onSubmit={async event => {
                    event.preventDefault();
                    const members = guestMembers
                      .split(',')
                      .map(member => member.trim())
                      .filter(Boolean);

                    if (!groupName.trim()) return;

                    await onCreateGroup({ name: groupName.trim(), guestMembers: members });
                    setGroupName('');
                    setGuestMembers('');
                    setShowGroupActions(false);
                  }}
                >
                  <label className="field">
                    <span className="field__label">Nombre del grupo</span>
                    <input
                      className="field__input"
                      type="text"
                      placeholder="Piso, viaje, pareja..."
                      value={groupName}
                      onChange={event => setGroupName(event.target.value)}
                    />
                  </label>

                  <button type="submit" className="button button--primary">
                    {groupsBusy ? 'Guardando...' : 'Crear grupo'}
                  </button>
                </form>

                <form
                  className="form-stack"
                  onSubmit={async event => {
                    event.preventDefault();
                    if (!joinCode.trim()) return;
                    await onJoinByCode(joinCode.trim());
                    setJoinCode('');
                    setShowGroupActions(false);
                  }}
                >
                  <label className="field">
                    <span className="field__label">Código del grupo</span>
                    <input
                      className="field__input"
                      type="text"
                      placeholder="ABCD1234"
                      value={joinCode}
                      onChange={event => setJoinCode(event.target.value.toUpperCase())}
                    />
                  </label>

                  <button type="submit" className="button button--ghost">
                    {groupsBusy ? 'Uniendo...' : 'Unirme con código'}
                  </button>
                </form>
              </div>
            </SectionCard>
          ) : null}

          <section className="detail-hero">
            <div className="screen-intro__eyebrow">Detalle de grupo</div>
            <h2 className="screen-intro__title">{selectedGroup.name}</h2>
            <p className="screen-intro__body">
              Consulta balances, registra gastos y gestiona pagos solo dentro del grupo que estás revisando.
            </p>
          </section>

          <div className="stats-grid">
            <StatCard label="Total grupo" value={formatMoney(summary.total, selectedGroup.currency)} />
            <StatCard label="Gastos" value={`${summary.count}`} />
            <StatCard label="Miembros" value={`${selectedGroup.members.length}`} />
          </div>

          <SectionCard
            title="Acceso y participantes"
            subtitle={
              selectedGroupJoinCode
                ? 'Puedes compartir este código con otros usuarios del sistema.'
                : 'Si necesitas compartir un código, accede con un admin del grupo.'
            }
          >
            <div className="list-stack">
              {selectedGroupJoinCode ? (
                <article className="list-row">
                  <div>
                    <div className="list-row__title">{selectedGroupJoinCode}</div>
                    <div className="list-row__meta">Código fijo de acceso</div>
                  </div>
                  <button
                    type="button"
                    className="button button--ghost button--small"
                    onClick={() => {
                      if (typeof navigator !== 'undefined' && navigator.clipboard) {
                        navigator.clipboard.writeText(selectedGroupJoinCode);
                      }
                    }}
                  >
                    Copiar
                  </button>
                </article>
              ) : null}

              <div className="member-pill-row">
                {selectedGroup.members.map(member => (
                  <div key={member.id} className="member-pill">
                    {member.displayName}
                  </div>
                ))}
              </div>

              <form
                className="form-stack"
                onSubmit={async event => {
                  event.preventDefault();
                  if (!memberName.trim()) return;
                  await onAddMember({ groupId: selectedGroup.id, displayName: memberName.trim() });
                  setMemberName('');
                }}
              >
                <label className="field">
                  <span className="field__label">Nuevo invitado</span>
                  <input
                    className="field__input"
                    type="text"
                    placeholder="Añade otro participante"
                    value={memberName}
                    onChange={event => setMemberName(event.target.value)}
                  />
                </label>
                <button type="submit" className="button button--ghost">
                  Añadir miembro
                </button>
              </form>
            </div>
          </SectionCard>

          <SectionCard
            title={editingExpenseId ? 'Editar gasto' : 'Añadir gasto'}
            subtitle="Registra un gasto con reparto equitativo o personalizado sin salir del detalle."
          >
            <form
              className="form-stack"
              onSubmit={async event => {
                event.preventDefault();
                const amount = Number(expenseAmount);
                const defaultPayer = payerMemberId || selectedGroup.members[0]?.id;

                if (!expenseDescription.trim() || !defaultPayer || !Number.isFinite(amount) || amount <= 0) {
                  return;
                }

                const manualSplits =
                  splitMethod === 'manual'
                    ? manualSplitDrafts.map(split => ({
                        memberId: split.member.id,
                        shareAmount: split.parsedValue || 0,
                      }))
                    : undefined;

                if (!manualSplitIsValid) {
                  return;
                }

                const expenseInput = {
                  groupId: selectedGroup.id,
                  description: expenseDescription.trim(),
                  amount,
                  payerMemberId: defaultPayer,
                  splitMethod,
                  splits: manualSplits,
                } as const;

                if (editingExpenseId) {
                  await onUpdateExpense({
                    expenseId: editingExpenseId,
                    ...expenseInput,
                  });
                } else {
                  await onAddExpense(expenseInput);
                }

                resetExpenseForm();
              }}
            >
              <div className="section-split">
                <label className="field">
                  <span className="field__label">Concepto</span>
                  <input
                    className="field__input"
                    type="text"
                    placeholder="Supermercado, gasolina..."
                    value={expenseDescription}
                    onChange={event => setExpenseDescription(event.target.value)}
                  />
                </label>

                <label className="field">
                  <span className="field__label">Monto</span>
                  <input
                    className="field__input"
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    placeholder="0.00"
                    value={expenseAmount}
                    onChange={event => setExpenseAmount(event.target.value)}
                  />
                </label>
              </div>

              <label className="field">
                <span className="field__label">Pagó</span>
                <select
                  className="field__input"
                  value={payerMemberId || selectedGroup.members[0]?.id || ''}
                  onChange={event => setPayerMemberId(event.target.value)}
                >
                  {selectedGroup.members.map(member => (
                    <option key={member.id} value={member.id}>
                      {member.displayName}
                    </option>
                  ))}
                </select>
              </label>

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

              {splitMethod === 'manual' ? (
                <div className="form-stack">
                  <div className="section-split">
                    {manualSplitDrafts.map(split => (
                      <label key={split.member.id} className="field">
                        <span className="field__label">{split.member.displayName}</span>
                        <input
                          className="field__input"
                          type="number"
                          inputMode="decimal"
                          step="0.01"
                          placeholder="0.00"
                          value={split.rawValue}
                          onChange={event =>
                            setManualShares(current => ({
                              ...current,
                              [split.member.id]: event.target.value,
                            }))
                          }
                        />
                      </label>
                    ))}
                  </div>

                  <div className="split-summary">
                    <div className="split-summary__title">Reparto asignado</div>
                    <div className="split-summary__meta">
                      Total {formatMoney(expenseAmountValue || 0, selectedGroup.currency)} · Asignado{' '}
                      {formatMoney(fromCents(manualAssignedCents), selectedGroup.currency)} · Restante{' '}
                      {formatMoney(fromCents(manualRemainingCents), selectedGroup.currency)}
                    </div>
                    <button type="button" className="button button--ghost button--small" onClick={applyRemainingToLastMember}>
                      Completar resto
                    </button>
                  </div>
                </div>
              ) : null}

              <div className="form-actions">
                <button type="submit" className="button button--primary" disabled={splitMethod === 'manual' && !manualSplitIsValid}>
                  {groupsBusy ? 'Guardando...' : editingExpenseId ? 'Guardar cambios' : 'Añadir gasto'}
                </button>
                {editingExpenseId ? (
                  <button type="button" className="button button--ghost" onClick={resetExpenseForm}>
                    Cancelar edición
                  </button>
                ) : null}
              </div>
            </form>
          </SectionCard>

          <SectionCard title="Balances" subtitle="Quién adelantó más y quién tiene que compensar dentro del grupo.">
            <div className="list-stack">
              {balances.map(balance => (
                <article key={balance.memberId} className="list-row">
                  <div>
                    <div className="list-row__title">{balance.memberName}</div>
                    <div className="list-row__meta">
                      Pagó {formatMoney(balance.paid, selectedGroup.currency)} · Debe {formatMoney(balance.owes, selectedGroup.currency)} ·
                      Liquidado {formatMoney(balance.settledIn - balance.settledOut, selectedGroup.currency)}
                    </div>
                  </div>
                  <div className={`amount-pill ${balance.net >= 0 ? 'amount-pill--positive' : 'amount-pill--negative'}`}>
                    {formatMoney(balance.net, selectedGroup.currency)}
                  </div>
                </article>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Sugerencias de liquidación" subtitle="Atajos para saldar el grupo sin revisar todos los saldos manualmente.">
            {suggestions.length === 0 ? (
              <EmptyState title="Todo está equilibrado" description="Cuando existan deudas pendientes aparecerán aquí." />
            ) : (
              <div className="list-stack">
                {suggestions.map((suggestion, index) => (
                  <article key={`${suggestion.fromMemberId}-${suggestion.toMemberId}-${index}`} className="list-row list-row--stacked">
                    <div className="list-row__content">
                      <div className="list-row__title">
                        {suggestion.fromMemberName} → {suggestion.toMemberName}
                      </div>
                      <div className="list-row__meta">Recomendación de liquidación</div>
                    </div>
                    <div className="list-actions">
                      <div className="amount-pill amount-pill--accent">{formatMoney(suggestion.amount, selectedGroup.currency)}</div>
                      {suggestion.fromMemberId === currentUserMember?.id ? (
                        <>
                          <button
                            type="button"
                            className="button button--primary button--small"
                            onClick={() =>
                              onCreateSettlement({
                                groupId: selectedGroup.id,
                                fromMemberId: suggestion.fromMemberId,
                                toMemberId: suggestion.toMemberId,
                                amount: suggestion.amount,
                              })
                            }
                          >
                            Liquidar ahora
                          </button>
                          <button
                            type="button"
                            className="button button--ghost button--small"
                            onClick={() => {
                              setSettlementFromId(suggestion.fromMemberId);
                              setSettlementToId(suggestion.toMemberId);
                              setSettlementAmount(String(suggestion.amount));
                            }}
                          >
                            Ajustar importe
                          </button>
                        </>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard title="Liquidaciones" subtitle="Registra pagos reales y revisa el historial del grupo.">
            {currentUserMember && currentUserBalance && currentUserBalance.net < 0 ? (
              <form
                className="form-stack"
                onSubmit={async event => {
                  event.preventDefault();
                  const amount = Number(settlementAmount);

                  if (
                    !settlementFromId ||
                    !settlementToId ||
                    settlementFromId === settlementToId ||
                    !Number.isFinite(amount) ||
                    amount <= 0
                  ) {
                    return;
                  }

                  await onCreateSettlement({
                    groupId: selectedGroup.id,
                    fromMemberId: settlementFromId,
                    toMemberId: settlementToId,
                    amount,
                  });

                  setSettlementAmount('');
                }}
              >
                <div className="section-split">
                  <label className="field">
                    <span className="field__label">De</span>
                    <input className="field__input" type="text" value={currentUserMember.displayName} readOnly />
                  </label>

                  <label className="field">
                    <span className="field__label">A</span>
                    <select className="field__input" value={settlementToId} onChange={event => setSettlementToId(event.target.value)}>
                      {availableSettlementTargets.map(member => (
                        <option key={member.id} value={member.id}>
                          {member.displayName}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <label className="field">
                  <span className="field__label">Monto</span>
                  <input
                    className="field__input"
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    placeholder="0.00"
                    value={settlementAmount}
                    onChange={event => setSettlementAmount(event.target.value)}
                  />
                </label>

                <button type="submit" className="button button--ghost">
                  Registrar pago
                </button>
              </form>
            ) : (
              <EmptyState
                title="Sin pagos pendientes tuyos"
                description="Cuando tengas deuda pendiente podrás registrar aquí una liquidación total o parcial."
              />
            )}

            {settlements.length === 0 ? (
              <EmptyState title="Sin liquidaciones" description="Cuando registres una aparecerá aquí con su estado." />
            ) : (
              <div className="list-stack">
                {settlements.map(settlement => {
                  const fromMember = selectedGroup.members.find(member => member.id === settlement.fromMemberId);
                  const toMember = selectedGroup.members.find(member => member.id === settlement.toMemberId);

                  return (
                    <article key={settlement.id} className="list-row list-row--stacked">
                      <div className="list-row__content">
                        <div className="list-row__title">
                          {fromMember?.displayName || 'Miembro'} → {toMember?.displayName || 'Miembro'}
                        </div>
                        <div className="list-row__meta">
                          {formatDate(settlement.occurredAt)} · Estado {settlement.status}
                        </div>
                      </div>
                      <div className="amount-pill amount-pill--accent">{formatMoney(settlement.amount, selectedGroup.currency)}</div>
                    </article>
                  );
                })}
              </div>
            )}
          </SectionCard>

          <SectionCard title="Gastos recientes" subtitle="Historial del grupo con acceso directo a edición cuando tienes permiso.">
            {expenses.length === 0 ? (
              <EmptyState title="Aún no hay gastos" description="Añade el primer gasto del grupo para empezar a repartir." />
            ) : (
              <div className="list-stack">
                {expenses.map(expense => {
                  const payer = selectedGroup.members.find(member => member.id === expense.payerMemberId);
                  const splitLabel = expense.splitMethod === 'equal' ? 'Equitativo' : 'Personalizado';

                  return (
                    <article key={expense.id} className="list-row list-row--stacked">
                      <div className="list-row__content">
                        <div className="list-row__title">{expense.description || 'Gasto compartido'}</div>
                        <div className="list-row__meta">
                          {formatDate(expense.occurredAt)} · Pagó {payer?.displayName || 'Miembro'} · Reparto {splitLabel}
                        </div>
                      </div>
                      <div className="list-actions">
                        <div className="amount-pill amount-pill--accent">{formatMoney(expense.amount, selectedGroup.currency)}</div>
                        {editableExpenseIds.has(expense.id) ? (
                          <button type="button" className="button button--ghost button--small" onClick={() => startEditingExpense(expense)}>
                            Editar
                          </button>
                        ) : null}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </SectionCard>
        </>
      ) : (
        <SectionCard>
          <EmptyState
            title="Selecciona un grupo"
            description="Vuelve al listado y abre uno de tus grupos para consultar balances, gastos y liquidaciones."
            actionLabel="Ir al listado"
            onAction={() => setView('list')}
          />
        </SectionCard>
      )}

      {error ? <div className="form-error">{error}</div> : null}
    </div>
  );
};
