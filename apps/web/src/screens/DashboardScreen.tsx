import { EmptyState } from '@/components/EmptyState';
import { SectionCard } from '@/components/SectionCard';
import { StatCard } from '@/components/StatCard';
import { summarizeTransactions } from '@/lib/groups';
import { formatDate, formatMoney } from '@/lib/format';
import type { AuthUser, GroupSummary, Transaction } from '@/types';

type DashboardScreenProps = {
  groups: GroupSummary[];
  onGoToGroups: () => void;
  onGoToTransactions: () => void;
  summary: {
    balance: number;
    income: number;
    expense: number;
  };
  transactions: Transaction[];
  user: AuthUser;
};

export const DashboardScreen = ({
  groups,
  onGoToGroups,
  onGoToTransactions,
  summary,
  transactions,
  user,
}: DashboardScreenProps) => {
  const featuredGroup = groups[0];
  const featuredGroupSummary = featuredGroup ? summarizeTransactions(featuredGroup) : null;
  const latestTransactions = transactions.slice(0, 3);

  return (
    <div className="screen-stack">
      <section className="hero-balance">
        <div className="hero-balance__label">Saldo total</div>
        <div className="hero-balance__value">{formatMoney(summary.balance, user.currency)}</div>
        <div className="hero-balance__meta">
          <span>Ingresos {formatMoney(summary.income, user.currency)}</span>
          <span>Gastos {formatMoney(summary.expense, user.currency)}</span>
        </div>
      </section>

      <div className="stats-grid">
        <StatCard label="Disponible" value={formatMoney(summary.balance, user.currency)} tone="accent" />
        <StatCard label="Este mes" value={formatMoney(summary.expense, user.currency)} tone="warning" />
        <StatCard label="Ingresos" value={formatMoney(summary.income, user.currency)} tone="positive" />
      </div>

      <SectionCard
        title={`Hola, ${user.name || user.email}`}
        subtitle="Tu resumen diario se actualiza con datos reales de tu cuenta y con tus grupos persistidos."
      >
        <div className="quick-actions">
          <button type="button" className="button button--primary" onClick={onGoToTransactions}>
            Añadir movimiento
          </button>
          <button type="button" className="button button--ghost" onClick={onGoToGroups}>
            Gestionar grupos
          </button>
        </div>
      </SectionCard>

      <SectionCard title="Actividad reciente" subtitle="Tus últimos movimientos personales.">
        {latestTransactions.length === 0 ? (
          <EmptyState
            title="Todavía no hay actividad"
            description="Crea tu primer ingreso o gasto y aparecerá aquí con prioridad."
            actionLabel="Crear movimiento"
            onAction={onGoToTransactions}
          />
        ) : (
          <div className="list-stack">
            {latestTransactions.map(transaction => {
              const amount = Number(transaction.amount) || 0;
              return (
                <article key={transaction.id} className="list-row">
                  <div>
                    <div className="list-row__title">{transaction.category || (transaction.type === 'income' ? 'Ingreso' : 'Gasto')}</div>
                    <div className="list-row__meta">{formatDate(transaction.occurredAt)}</div>
                  </div>
                  <div className={`amount-pill ${transaction.type === 'income' ? 'amount-pill--positive' : 'amount-pill--negative'}`}>
                    {transaction.type === 'income' ? '+' : '-'}
                    {formatMoney(amount, user.currency)}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </SectionCard>

      <SectionCard title="Radar de grupos" subtitle="Vista rápida del frente compartido.">
        {featuredGroup ? (
          <div className="group-spotlight">
            <div className="group-spotlight__header">
              <div>
                <div className="group-spotlight__title">{featuredGroup.name}</div>
                <div className="group-spotlight__meta">{featuredGroup.membersCount} miembros</div>
              </div>
              <button type="button" className="button button--ghost button--small" onClick={onGoToGroups}>
                Ver grupo
              </button>
            </div>
            <div className="stats-grid stats-grid--compact">
              <StatCard
                label="Gasto total"
                value={formatMoney(featuredGroupSummary?.total || 0, featuredGroup.currency)}
                tone="default"
              />
              <StatCard label="Movimientos" value={`${featuredGroupSummary?.count || 0}`} tone="default" />
            </div>
            <div className="group-spotlight__caption">
              Usa la pestaña Grupos para registrar gastos compartidos y ver balances sugeridos.
            </div>
          </div>
        ) : (
          <EmptyState
            title="Crea tu primer grupo"
            description="Añade amigos, pareja o compañeros de piso y empieza a repartir gastos desde el móvil."
            actionLabel="Ir a grupos"
            onAction={onGoToGroups}
          />
        )}
      </SectionCard>
    </div>
  );
};
