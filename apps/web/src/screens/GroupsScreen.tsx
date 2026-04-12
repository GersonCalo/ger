import { useEffect, useMemo, useState } from 'react';
import { EmptyState } from '@/components/EmptyState';
import { SectionCard } from '@/components/SectionCard';
import { StatCard } from '@/components/StatCard';
import { formatDate, formatMoney } from '@/lib/format';
import { summarizeTransactions } from '@/lib/groups';
import type { AuthUser, GroupBalancesPayload, GroupExpense, GroupExpenseSplitInput, GroupSummary, Category } from '@/types';

const CATEGORY_COLORS = ['#EC4899', '#22C55E', '#3B82F6', '#F97316', '#A855F7', '#64748B', '#EF4444', '#6366F1', '#06B6D4', '#10B981', '#F59E0B', '#8B5CF6'];
const CATEGORY_ICONS = ['💰', '💼', '🎁', '📈', '🛍️', '🎮', '🛒', '🚌', '🍽️', '👕', '🏠', '🏥', '📚', '📺', '✈️', '🔧', '💻', '🎓', '🚗', '🏦'];

type GroupsScreenProps = {
  error: string | null;
  groups: GroupSummary[];
  groupsBusy: boolean;
  notice: string;
  categories?: Category[];
  onAddMember: (input: { groupId: string; displayName: string }) => Promise<void>;
  onDeleteMember: (groupId: string, memberId: string) => Promise<void>;
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
    categoryId?: string;
    splitMethod: 'equal' | 'manual' | 'weights';
    splits?: GroupExpenseSplitInput[];
    occurredAt: string;
  }) => Promise<void>;
  onCreateGroupCategory: (groupId: string, input: { name: string; type: 'income' | 'expense'; color?: string; icon?: string }) => Promise<any>;
  onUpdateGroupCategory: (groupId: string, categoryId: string, input: { name?: string; color?: string; icon?: string }) => Promise<any>;
  onDeleteGroupCategory: (groupId: string, categoryId: string) => Promise<void>;
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
  onDeleteMember,
  onCreateGroup,
  onCreateSettlement,
  onJoinByCode,
  onSelectGroup,
  onUpdateExpense,
  onCreateGroupCategory,
  onUpdateGroupCategory,
  onDeleteGroupCategory,
  selectedGroupData,
  selectedGroupId,
  selectedGroupJoinCode,
  user,
  categories = [],
}: GroupsScreenProps) => {
  const [view, setView] = useState<'list' | 'detail'>('list');
  const [detailTab, setDetailTab] = useState<'summary' | 'expenses' | 'payments' | 'settings'>('summary');
  const [showGroupActions, setShowGroupActions] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [guestMembers, setGuestMembers] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [memberName, setMemberName] = useState('');
  const [expenseDescription, setExpenseDescription] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseCategoryId, setExpenseCategoryId] = useState('');
  const [payerMemberId, setPayerMemberId] = useState('');
  const [splitMethod, setSplitMethod] = useState<'equal' | 'manual'>('equal');
  const [manualShares, setManualShares] = useState<Record<string, string>>({});
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [settlementAmount, setSettlementAmount] = useState('');
  const [settlementFromId, setSettlementFromId] = useState('');
  const [settlementToId, setSettlementToId] = useState('');
  const [deleteMemberConfirm, setDeleteMemberConfirm] = useState<string | null>(null);
  const [deleteMemberBusy, setDeleteMemberBusy] = useState(false);
  
  // Group category management state
  const [groupCategoryTab, setGroupCategoryTab] = useState<'income' | 'expense'>('expense');
  const [editingGroupCategory, setEditingGroupCategory] = useState<Category | null>(null);
  const [showCreateGroupCategory, setShowCreateGroupCategory] = useState(false);
  const [deleteGroupCategoryConfirm, setDeleteGroupCategoryConfirm] = useState<string | null>(null);
  const [groupCategoryFormName, setGroupCategoryFormName] = useState('');
  const [groupCategoryFormColor, setGroupCategoryFormColor] = useState(CATEGORY_COLORS[0]);
  const [groupCategoryFormIcon, setGroupCategoryFormIcon] = useState(CATEGORY_ICONS[0]);
  const [groupCategoryBusy, setGroupCategoryBusy] = useState(false);
  const [groupCategoryError, setGroupCategoryError] = useState<string | null>(null);

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
  const availableSettlementTargets =
    selectedGroupData?.members.filter(member => creditorBalances.some(balance => balance.memberId === member.id)) || [];
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
    setDetailTab('summary');
    setEditingExpenseId(null);
    setExpenseDescription('');
    setExpenseAmount('');
    setExpenseCategoryId('');
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
    setExpenseCategoryId('');
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
    setExpenseCategoryId(expense.categoryId || '');
    setPayerMemberId(expense.payerMemberId);
    setSplitMethod(expense.splitMethod === 'equal' ? 'equal' : 'manual');
    setManualShares(buildManualShareState(selectedGroupData.members, expense));
    setDetailTab('expenses');
  };

  const openGroupDetail = (groupId: string) => {
    onSelectGroup(groupId);
    setDetailTab('summary');
    setView('detail');
  };

  const resetGroupCategoryForm = () => {
    setGroupCategoryFormName('');
    setGroupCategoryFormColor(CATEGORY_COLORS[0]);
    setGroupCategoryFormIcon(CATEGORY_ICONS[0]);
    setEditingGroupCategory(null);
    setShowCreateGroupCategory(false);
    setGroupCategoryError(null);
  };

  return (
    <div className="screen-stack">
      {view === 'list' ? (
        <SectionCard
          title="Tus grupos"
          action={
            <button type="button" className="button button--ghost button--small" onClick={() => setShowGroupActions(current => !current)}>
              {showGroupActions ? 'Cerrar' : 'Crear o unirme'}
            </button>
          }
        >
          {showGroupActions ? (
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
          ) : groups.length === 0 ? (
            <EmptyState title="Todavía no hay grupos" description="Crea uno nuevo o entra con un código." />
          ) : (
            <>
              <div className="stats-grid">
                <StatCard label="Tus grupos" value={`${groups.length}`} />
                <StatCard label="Total movimientos" value={`${groups.reduce((sum, group) => sum + group.expensesCount, 0)}`} />
              </div>
              {notice ? <div className="helper-note">{notice}</div> : null}
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
                          <span>{formatDate(group.createdAt)}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </SectionCard>
      ) : selectedGroup ? (
        <>
          <div className="detail-toolbar">
            <button
              type="button"
              className="button button--ghost button--small"
              onClick={() => {
                setDetailTab('summary');
                setView('list');
              }}
            >
              Volver a grupos
            </button>
          </div>

          <section className="detail-hero detail-hero--compact">
            <h2 className="screen-intro__title">{selectedGroup.name}</h2>
          </section>

          <div className="segmented-control detail-tabs">
            <button
              type="button"
              className={`segmented-control__item ${detailTab === 'summary' ? 'segmented-control__item--active' : ''}`}
              onClick={() => setDetailTab('summary')}
            >
              Resumen
            </button>
            <button
              type="button"
              className={`segmented-control__item ${detailTab === 'expenses' ? 'segmented-control__item--active' : ''}`}
              onClick={() => setDetailTab('expenses')}
            >
              Gastos
            </button>
            <button
              type="button"
              className={`segmented-control__item ${detailTab === 'payments' ? 'segmented-control__item--active' : ''}`}
              onClick={() => setDetailTab('payments')}
            >
              Pagos
            </button>
            <button
              type="button"
              className={`segmented-control__item ${detailTab === 'settings' ? 'segmented-control__item--active' : ''}`}
              onClick={() => setDetailTab('settings')}
            >
              Ajustes
            </button>
          </div>

          {detailTab === 'summary' ? (
            <div className="tab-panel">
              <div className="stats-grid">
                <StatCard label="Total" value={formatMoney(summary.total, selectedGroup.currency)} />
                <StatCard label="Gastos" value={`${summary.count}`} />
                <StatCard label="Miembros" value={`${selectedGroup.members.length}`} />
              </div>

              <SectionCard title="Balances">
                <div className="list-stack">
                  {balances.map(balance => (
                    <article key={balance.memberId} className="list-row">
                      <div>
                        <div className="list-row__title">{balance.memberName}</div>
                        <div className="list-row__meta">
                          Pagó {formatMoney(balance.paid, selectedGroup.currency)} · Debe {formatMoney(balance.owes, selectedGroup.currency)}
                        </div>
                      </div>
                      <div className={`amount-pill ${balance.net >= 0 ? 'amount-pill--positive' : 'amount-pill--negative'}`}>
                        {formatMoney(balance.net, selectedGroup.currency)}
                      </div>
                    </article>
                  ))}
                </div>
              </SectionCard>
            </div>
          ) : null}

          {detailTab === 'expenses' ? (
            <div className="tab-panel">
              <SectionCard title={editingExpenseId ? 'Editar gasto' : 'Añadir gasto'}>
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
                      categoryId: expenseCategoryId || undefined,
                      splitMethod,
                      splits: manualSplits,
                      occurredAt: new Date().toISOString(),
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

                  <div className="section-split">
                    <label className="field">
                      <span className="field__label">
                        Categoría
                        {!showAddCategory && (
                          <button
                            type="button"
                            className="button button--ghost"
                            style={{ fontSize: '0.8em', padding: '0 4px', height: 'auto', minHeight: '0' }}
                            onClick={() => setShowAddCategory(true)}
                          >
                            + Nueva
                          </button>
                        )}
                      </span>
                      
                      {showAddCategory ? (
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <input
                            className="field__input"
                            type="text"
                            placeholder="Ej. 🍕 Comida"
                            value={newCategoryName}
                            onChange={e => setNewCategoryName(e.target.value)}
                            style={{ flex: 1 }}
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
                                
                                const cat = await onCreateGroupCategory(selectedGroup.id, { name, type: 'expense', icon });
                                setExpenseCategoryId(cat.id);
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
                            X
                          </button>
                        </div>
                      ) : (
                        <select
                          className="field__input"
                          value={expenseCategoryId}
                          onChange={event => setExpenseCategoryId(event.target.value)}
                        >
                          <option value="">Sin categoría</option>
                          {categories
                            .filter(c => c.type === 'expense' && (c.groupId === null || c.groupId === selectedGroup.id))
                            .map(c => (
                              <option key={c.id} value={c.id}>
                                {c.icon ? `${c.icon} ` : ''}{c.name}
                              </option>
                            ))}
                        </select>
                      )}
                    </label>

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
                        <div className="split-summary__title">Reparto</div>
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

              <SectionCard title="Historial">
                {expenses.length === 0 ? (
                  <EmptyState title="Sin gastos" description="Añade el primero." />
                ) : (
                  <div className="list-stack">
                    {expenses.map(expense => {
                      const payer = selectedGroup.members.find(member => member.id === expense.payerMemberId);
                      const splitLabel = expense.splitMethod === 'equal' ? 'Equitativo' : 'Personalizado';

                      return (
                        <article key={expense.id} className="list-row list-row--stacked">
                          <div className="list-row__content">
                            <div className="list-row__title">
                              {expense.category ? (
                                <span className="category-tag">
                                  {expense.category.icon ? `${expense.category.icon} ` : ''}
                                  {expense.category.name}
                                </span>
                              ) : null}
                              {expense.category ? ' · ' : ''}
                              {expense.description || 'Gasto compartido'}
                            </div>
                            <div className="list-row__meta">
                              {formatDate(expense.occurredAt)} · Pagó {payer?.displayName || 'Miembro'} · {splitLabel}
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
            </div>
          ) : null}

          {detailTab === 'payments' ? (
            <div className="tab-panel">
              <SectionCard title="Sugerencias">
                {suggestions.length === 0 ? (
                  <EmptyState title="Todo al día" description="No hay pagos sugeridos." />
                ) : (
                  <div className="list-stack">
                    {suggestions.map((suggestion, index) => (
                      <article key={`${suggestion.fromMemberId}-${suggestion.toMemberId}-${index}`} className="list-row list-row--stacked">
                        <div className="list-row__content">
                          <div className="list-row__title">
                            {suggestion.fromMemberName} → {suggestion.toMemberName}
                          </div>
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
                                Liquidar
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
                                Ajustar
                              </button>
                            </>
                          ) : null}
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </SectionCard>

              <SectionCard title="Registrar pago">
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
                  <EmptyState title="Sin pagos pendientes" description="Nada que registrar." />
                )}
              </SectionCard>

              <SectionCard title="Historial">
                {settlements.length === 0 ? (
                  <EmptyState title="Sin pagos" description="Aún no hay liquidaciones." />
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
                              {formatDate(settlement.occurredAt)} · {settlement.status}
                            </div>
                          </div>
                          <div className="amount-pill amount-pill--accent">{formatMoney(settlement.amount, selectedGroup.currency)}</div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </SectionCard>
            </div>
          ) : null}

          {detailTab === 'settings' ? (
            <div className="tab-panel">
              <SectionCard title="Miembros">
                <div className="list-stack">
                  {deleteMemberConfirm ? (
                    <div className="form-stack">
                      <p style={{ fontSize: 14, color: 'var(--color-text-muted)', margin: 0 }}>
                        ¿Estás seguro de que quieres eliminar a{' '}
                        <strong>{selectedGroup.members.find(m => m.id === deleteMemberConfirm)?.displayName}</strong> del grupo?
                        Perderá acceso pero el histórico de gastos se mantendrá.
                      </p>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          type="button"
                          className="button button--danger button--small"
                          disabled={deleteMemberBusy}
                          onClick={async () => {
                            setDeleteMemberBusy(true);
                            try {
                              await onDeleteMember(selectedGroup.id, deleteMemberConfirm);
                            } catch {
                              // Error already handled by the hook
                            } finally {
                              setDeleteMemberBusy(false);
                            }
                            setDeleteMemberConfirm(null);
                          }}
                        >
                          {deleteMemberBusy ? 'Eliminando...' : 'Confirmar eliminación'}
                        </button>
                        <button
                          type="button"
                          className="button button--ghost button--small"
                          onClick={() => setDeleteMemberConfirm(null)}
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="member-pill-row">
                      {selectedGroup.members.map(member => {
                        const isAdmin = currentUserMember?.role === 'admin';
                        const isSelf = member.userId === user.id;
                        return (
                          <div key={member.id} className="member-pill" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span>{member.displayName}</span>
                            {isAdmin && !isSelf ? (
                              <button
                                type="button"
                                className="member-pill__delete"
                                title="Eliminar del grupo"
                                onClick={() => setDeleteMemberConfirm(member.id)}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  cursor: 'pointer',
                                  color: 'var(--color-danger, #ef4444)',
                                  fontSize: 14,
                                  padding: '0 2px',
                                  lineHeight: 1,
                                }}
                              >
                                ×
                              </button>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  )}

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

              <SectionCard title="Código del grupo">
                {selectedGroupJoinCode ? (
                  <article className="list-row">
                    <div>
                      <div className="list-row__title">{selectedGroupJoinCode}</div>
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
                ) : (
                  <EmptyState title="No disponible" description="Solo visible para admins." />
                )}
              </SectionCard>

              <SectionCard title="Categorías del grupo">
                <div className="category-manager">
                  {/* Tabs Ingresos/Gastos */}
                  <div className="category-tabs">
                    <button
                      type="button"
                      className={`category-tabs__btn ${groupCategoryTab === 'income' ? 'category-tabs__btn--active' : ''}`}
                      onClick={() => { setGroupCategoryTab('income'); resetGroupCategoryForm(); }}
                    >
                      Ingresos
                    </button>
                    <button
                      type="button"
                      className={`category-tabs__btn ${groupCategoryTab === 'expense' ? 'category-tabs__btn--active' : ''}`}
                      onClick={() => { setGroupCategoryTab('expense'); resetGroupCategoryForm(); }}
                    >
                      Gastos
                    </button>
                  </div>

                  {/* Botón Nueva Categoría */}
                  {!showCreateGroupCategory && !editingGroupCategory && (
                    <button
                      type="button"
                      className="button button--primary button--full"
                      onClick={() => { setShowCreateGroupCategory(true); setGroupCategoryError(null); }}
                    >
                      + Nueva categoría
                    </button>
                  )}

                  {/* Formulario Crear/Editar */}
                  {(showCreateGroupCategory || editingGroupCategory) && (
                    <form className="category-form" onSubmit={async (e) => {
                      e.preventDefault();
                      if (!groupCategoryFormName.trim() || !selectedGroupId) return;

                      setGroupCategoryBusy(true);
                      setGroupCategoryError(null);
                      try {
                        if (editingGroupCategory) {
                          await onUpdateGroupCategory(selectedGroupId, editingGroupCategory.id, {
                            name: groupCategoryFormName.trim(),
                            color: groupCategoryFormColor,
                            icon: groupCategoryFormIcon,
                          });
                        } else {
                          await onCreateGroupCategory(selectedGroupId, {
                            name: groupCategoryFormName.trim(),
                            type: groupCategoryTab,
                            color: groupCategoryFormColor,
                            icon: groupCategoryFormIcon,
                          });
                        }
                        resetGroupCategoryForm();
                      } catch (err: any) {
                        setGroupCategoryError(err.message || 'Error guardando categoría');
                      } finally {
                        setGroupCategoryBusy(false);
                      }
                    }}>
                      <div className="category-form__header">
                        <h4>{editingGroupCategory ? 'Editar categoría' : 'Nueva categoría'}</h4>
                        <button type="button" className="button button--ghost button--sm" onClick={resetGroupCategoryForm}>✕</button>
                      </div>
                      <label className="category-form__field">
                        <span>Nombre</span>
                        <input
                          type="text"
                          value={groupCategoryFormName}
                          onChange={e => setGroupCategoryFormName(e.target.value)}
                          placeholder="Nombre de la categoría"
                          required
                        />
                      </label>
                      <label className="category-form__field">
                        <span>Icono</span>
                        <div className="category-form__options">
                          {CATEGORY_ICONS.map(icon => (
                            <button
                              key={icon}
                              type="button"
                              className={`category-form__option ${groupCategoryFormIcon === icon ? 'category-form__option--active' : ''}`}
                              onClick={() => setGroupCategoryFormIcon(icon)}
                            >
                              {icon}
                            </button>
                          ))}
                        </div>
                      </label>
                      <label className="category-form__field">
                        <span>Color</span>
                        <div className="category-form__options">
                          {CATEGORY_COLORS.map(color => (
                            <button
                              key={color}
                              type="button"
                              className={`category-form__color ${groupCategoryFormColor === color ? 'category-form__option--active' : ''}`}
                              style={{ background: color }}
                              onClick={() => setGroupCategoryFormColor(color)}
                            />
                          ))}
                        </div>
                      </label>
                      {groupCategoryError && <div className="category-form__error">{groupCategoryError}</div>}
                      <button type="submit" className="button button--primary button--full" disabled={groupCategoryBusy}>
                        {groupCategoryBusy ? 'Guardando...' : editingGroupCategory ? 'Guardar cambios' : 'Crear categoría'}
                      </button>
                    </form>
                  )}

                  {/* Lista Categorías del Grupo */}
                  {(() => {
                    const groupCategories = (categories || []).filter(c => c.groupId === selectedGroupId && c.type === groupCategoryTab);
                    const globalCategories = (categories || []).filter(c => c.userId === null && c.groupId === null && c.type === groupCategoryTab);

                    return (
                      <>
                        {groupCategories.length > 0 && (
                          <div className="category-list">
                            <div className="category-list__header">
                              <h4>Categorías del grupo</h4>
                            </div>
                            {groupCategories.map(cat => (
                              deleteGroupCategoryConfirm === cat.id ? (
                                <div key={cat.id} className="category-item category-item--confirm-delete">
                                  <div className="category-item__info">
                                    <span className="category-item__icon">{cat.icon || '📁'}</span>
                                    <span className="category-item__name">{cat.name}</span>
                                  </div>
                                  <div className="category-item__actions">
                                    <button type="button" className="button button--ghost button--sm" onClick={() => setDeleteGroupCategoryConfirm(null)}>Cancelar</button>
                                    <button type="button" className="button button--danger button--sm" onClick={async () => {
                                      if (!selectedGroupId) return;
                                      setGroupCategoryBusy(true);
                                      setGroupCategoryError(null);
                                      try {
                                        await onDeleteGroupCategory(selectedGroupId, cat.id);
                                        setDeleteGroupCategoryConfirm(null);
                                      } catch (err: any) {
                                        setGroupCategoryError(err.message || 'Error eliminando categoría');
                                      } finally {
                                        setGroupCategoryBusy(false);
                                      }
                                    }} disabled={groupCategoryBusy}>
                                      {groupCategoryBusy ? '...' : 'Eliminar'}
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div key={cat.id} className="category-item">
                                  <div className="category-item__info">
                                    <span className="category-item__icon" style={{ background: cat.color || '#64748B' }}>{cat.icon || '📁'}</span>
                                    <span className="category-item__name">{cat.name}</span>
                                  </div>
                                  <div className="category-item__actions">
                                    <button type="button" className="button button--ghost button--sm" onClick={() => {
                                      setEditingGroupCategory(cat);
                                      setGroupCategoryFormName(cat.name);
                                      setGroupCategoryFormColor(cat.color || CATEGORY_COLORS[0]);
                                      setGroupCategoryFormIcon(cat.icon || CATEGORY_ICONS[0]);
                                      setShowCreateGroupCategory(false);
                                      setGroupCategoryError(null);
                                    }}>✏️</button>
                                    <button type="button" className="button button--ghost button--sm" onClick={() => setDeleteGroupCategoryConfirm(cat.id)}>🗑️</button>
                                  </div>
                                </div>
                              )
                            ))}
                          </div>
                        )}

                        {/* Lista Categorías Globales (solo lectura) */}
                        {globalCategories.length > 0 && (
                          <div className="category-list category-list--global">
                            <div className="category-list__header">
                              <h4>Por defecto</h4>
                            </div>
                            {globalCategories.map(cat => (
                              <div key={cat.id} className="category-item category-item--global">
                                <div className="category-item__info">
                                  <span className="category-item__icon" style={{ background: cat.color || '#64748B' }}>{cat.icon || '📁'}</span>
                                  <span className="category-item__name">{cat.name}</span>
                                </div>
                                <div className="category-item__badge">
                                  <span>por defecto</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {groupCategories.length === 0 && globalCategories.length === 0 && !showCreateGroupCategory && !editingGroupCategory && (
                          <div className="empty-state">
                            <p>No hay categorías de {groupCategoryTab === 'income' ? 'ingresos' : 'gastos'} aún.</p>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              </SectionCard>
            </div>
          ) : null}
        </>
      ) : (
        <SectionCard>
          <EmptyState
            title="Selecciona un grupo"
            description="Vuelve al listado y abre uno de tus grupos."
            actionLabel="Ir al listado"
            onAction={() => setView('list')}
          />
        </SectionCard>
      )}

      {error ? <div className="form-error">{error}</div> : null}
    </div>
  );
};
