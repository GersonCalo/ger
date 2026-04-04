import { useEffect, useMemo, useState } from 'react';
import { EmptyState } from '@/components/EmptyState';
import { SectionCard } from '@/components/SectionCard';
import { StatCard } from '@/components/StatCard';
import { calculateGroupBalances, createSettlementSuggestions, summarizeTransactions } from '@/lib/groups';
import { formatDate, formatMoney } from '@/lib/format';
import type { LocalGroup } from '@/types';

type GroupsScreenProps = {
  groups: LocalGroup[];
  notice: string;
  onAddExpense: (input: {
    groupId: string;
    description: string;
    amount: number;
    payerMemberId: string;
    splitMethod: 'equal' | 'weights';
  }) => void;
  onCreateGroup: (input: { name: string; guestMembers: string[] }) => void;
};

export const GroupsScreen = ({ groups, notice, onAddExpense, onCreateGroup }: GroupsScreenProps) => {
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(groups[0]?.id || null);
  const [groupName, setGroupName] = useState('');
  const [guestMembers, setGuestMembers] = useState('');
  const [expenseDescription, setExpenseDescription] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [payerMemberId, setPayerMemberId] = useState('');
  const [splitMethod, setSplitMethod] = useState<'equal' | 'weights'>('equal');

  const selectedGroup = useMemo(
    () => groups.find(group => group.id === selectedGroupId) || groups[0] || null,
    [groups, selectedGroupId]
  );

  const balances = useMemo(
    () => (selectedGroup ? calculateGroupBalances(selectedGroup) : []),
    [selectedGroup]
  );

  const suggestions = useMemo(() => createSettlementSuggestions(balances), [balances]);
  const summary = selectedGroup ? summarizeTransactions(selectedGroup) : { total: 0, count: 0 };

  useEffect(() => {
    if (!groups.length) {
      setSelectedGroupId(null);
      return;
    }

    if (!selectedGroupId || !groups.some(group => group.id === selectedGroupId)) {
      setSelectedGroupId(groups[0].id);
      setPayerMemberId(groups[0].members[0]?.id || '');
    }
  }, [groups, selectedGroupId]);

  return (
    <div className="screen-stack">
      <SectionCard title="Grupos compartidos" subtitle={notice}>
        <form
          className="form-stack"
          onSubmit={event => {
            event.preventDefault();
            const members = guestMembers
              .split(',')
              .map(member => member.trim())
              .filter(Boolean);

            if (!groupName.trim()) return;

            onCreateGroup({ name: groupName.trim(), guestMembers: members });
            setGroupName('');
            setGuestMembers('');
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
            Crear grupo
          </button>
        </form>
      </SectionCard>

      {groups.length === 0 ? (
        <SectionCard>
          <EmptyState
            title="Todavía no hay grupos"
            description="Crea un grupo para repartir gastos equitativos o por pesos desde esta misma pantalla."
          />
        </SectionCard>
      ) : (
        <>
          <SectionCard title="Tus grupos" subtitle="Selecciona uno para ver balances y registrar gastos.">
            <div className="chip-row">
              {groups.map(group => (
                <button
                  key={group.id}
                  type="button"
                  className={`chip ${group.id === selectedGroup?.id ? 'chip--active' : ''}`}
                  onClick={() => {
                    setSelectedGroupId(group.id);
                    setPayerMemberId(group.members[0]?.id || '');
                  }}
                >
                  {group.name}
                </button>
              ))}
            </div>
          </SectionCard>

          {selectedGroup ? (
            <>
              <div className="stats-grid">
                <StatCard label="Total grupo" value={formatMoney(summary.total, selectedGroup.currency)} />
                <StatCard label="Gastos" value={`${summary.count}`} />
                <StatCard label="Miembros" value={`${selectedGroup.members.length}`} />
              </div>

              <SectionCard title={selectedGroup.name} subtitle="Registra un gasto y calcula balances al instante.">
                <div className="member-pill-row">
                  {selectedGroup.members.map(member => (
                    <div key={member.id} className="member-pill">
                      {member.name}
                    </div>
                  ))}
                </div>

                <form
                  className="form-stack"
                  onSubmit={event => {
                    event.preventDefault();
                    const amount = Number(expenseAmount);
                    const defaultPayer = payerMemberId || selectedGroup.members[0]?.id;

                    if (!expenseDescription.trim() || !defaultPayer || !Number.isFinite(amount) || amount <= 0) return;

                    onAddExpense({
                      groupId: selectedGroup.id,
                      description: expenseDescription.trim(),
                      amount,
                      payerMemberId: defaultPayer,
                      splitMethod,
                    });

                    setExpenseDescription('');
                    setExpenseAmount('');
                  }}
                >
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

                  <label className="field">
                    <span className="field__label">Pagó</span>
                    <select
                      className="field__input"
                      value={payerMemberId || selectedGroup.members[0]?.id || ''}
                      onChange={event => setPayerMemberId(event.target.value)}
                    >
                      {selectedGroup.members.map(member => (
                        <option key={member.id} value={member.id}>
                          {member.name}
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
                      className={`segmented-control__item ${splitMethod === 'weights' ? 'segmented-control__item--active' : ''}`}
                      onClick={() => setSplitMethod('weights')}
                    >
                      Por pesos
                    </button>
                  </div>

                  <button type="submit" className="button button--primary">
                    Añadir gasto
                  </button>
                </form>
              </SectionCard>

              <SectionCard title="Balances" subtitle="Quién puso más y quién debe compensar.">
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

              <SectionCard title="Liquidaciones sugeridas" subtitle="Sugerencias automáticas para saldar el grupo.">
                {suggestions.length === 0 ? (
                  <EmptyState title="Todo está equilibrado" description="Cuando existan deudas pendientes aparecerán aquí." />
                ) : (
                  <div className="list-stack">
                    {suggestions.map((suggestion, index) => (
                      <article key={`${suggestion.from}-${suggestion.to}-${index}`} className="list-row">
                        <div>
                          <div className="list-row__title">
                            {suggestion.from} → {suggestion.to}
                          </div>
                          <div className="list-row__meta">Recomendación de liquidación</div>
                        </div>
                        <div className="amount-pill amount-pill--accent">
                          {formatMoney(suggestion.amount, selectedGroup.currency)}
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </SectionCard>

              <SectionCard title="Gastos del grupo" subtitle="Últimos gastos registrados.">
                {selectedGroup.expenses.length === 0 ? (
                  <EmptyState title="Aún no hay gastos" description="Añade el primer gasto del grupo para empezar a repartir." />
                ) : (
                  <div className="list-stack">
                    {selectedGroup.expenses.map(expense => {
                      const payer = selectedGroup.members.find(member => member.id === expense.payerMemberId);
                      return (
                        <article key={expense.id} className="list-row list-row--stacked">
                          <div className="list-row__content">
                            <div className="list-row__title">{expense.description}</div>
                            <div className="list-row__meta">
                              {formatDate(expense.occurredAt)} · Pagó {payer?.name || 'Miembro'}
                            </div>
                          </div>
                          <div className="amount-pill amount-pill--accent">
                            {formatMoney(expense.amount, selectedGroup.currency)}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </SectionCard>
            </>
          ) : null}
        </>
      )}
    </div>
  );
};
