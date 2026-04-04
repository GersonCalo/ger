import { AppShell } from '@/components/AppShell';
import { useFinanceApp } from '@/hooks/useFinanceApp';
import { AuthScreen } from '@/screens/AuthScreen';
import { DashboardScreen } from '@/screens/DashboardScreen';
import { GroupsScreen } from '@/screens/GroupsScreen';
import { ProfileScreen } from '@/screens/ProfileScreen';
import { TransactionsScreen } from '@/screens/TransactionsScreen';

const tabCopy = {
  home: {
    title: 'Control diario',
    subtitle: 'Resumen financiero personal y radar de grupos en una sola vista.',
  },
  transactions: {
    title: 'Movimientos',
    subtitle: 'Registra ingresos y gastos rápido, con interfaz optimizada para pulgar.',
  },
  groups: {
    title: 'Grupos',
    subtitle: 'Gestiona gastos compartidos y balances desde navegación inferior.',
  },
  profile: {
    title: 'Perfil',
    subtitle: 'Cuenta, entorno y estado técnico del despliegue.',
  },
} as const;

function App() {
  const financeApp = useFinanceApp();

  if (financeApp.booting) {
    return (
      <div className="app-shell">
        <div className="app-shell__ambient app-shell__ambient--one" />
        <div className="app-shell__ambient app-shell__ambient--two" />
        <div className="app-shell__phone">
          <header className="app-header">
            <div className="app-header__eyebrow">Finanzas Integradas</div>
            <h1 className="app-header__title">Sincronizando</h1>
            <p className="app-header__subtitle">Estamos recuperando tu sesión y tu actividad reciente.</p>
          </header>
          <main className="app-content">
            <section className="section-card">
              <div className="empty-state">
                <div className="empty-state__glyph">⋯</div>
                <div className="empty-state__title">Preparando tu panel</div>
                <div className="empty-state__description">Cargando cuenta, movimientos y grupos persistidos en la API.</div>
              </div>
            </section>
          </main>
        </div>
      </div>
    );
  }

  if (!financeApp.isAuthenticated) {
    return (
      <div className="app-shell">
        <div className="app-shell__ambient app-shell__ambient--one" />
        <div className="app-shell__ambient app-shell__ambient--two" />

        <div className="app-shell__phone">
          <header className="app-header">
            <div className="app-header__eyebrow">Finanzas Integradas</div>
            <h1 className="app-header__title">Tu dinero, claro</h1>
            <p className="app-header__subtitle">
              Interfaz mobile-first para finanzas personales y gastos compartidos.
            </p>
          </header>

          <main className="app-content">
            <AuthScreen
              busy={financeApp.authBusy}
              error={financeApp.authError}
              onLogin={financeApp.login}
              onRegister={financeApp.register}
            />
          </main>
        </div>
      </div>
    );
  }

  return (
    <AppShell
      activeTab={financeApp.activeTab}
      onTabChange={financeApp.setActiveTab}
      headerTitle={tabCopy[financeApp.activeTab].title}
      headerSubtitle={tabCopy[financeApp.activeTab].subtitle}
    >
      {financeApp.activeTab === 'home' ? (
        <DashboardScreen
          groups={financeApp.groups}
          onGoToGroups={() => financeApp.setActiveTab('groups')}
          onGoToTransactions={() => financeApp.setActiveTab('transactions')}
          summary={financeApp.dashboardSummary}
          transactions={financeApp.transactions}
          user={financeApp.user!}
        />
      ) : null}

      {financeApp.activeTab === 'transactions' ? (
        <TransactionsScreen
          busy={financeApp.dataBusy}
          error={financeApp.transactionError}
          onCreateTransaction={financeApp.createTransaction}
          onRefresh={financeApp.refreshTransactions}
          summary={financeApp.dashboardSummary}
          transactions={financeApp.transactions}
          user={financeApp.user!}
        />
      ) : null}

      {financeApp.activeTab === 'groups' ? (
        <GroupsScreen
          error={financeApp.groupsError}
          groups={financeApp.groups}
          groupsBusy={financeApp.groupsBusy}
          notice={financeApp.groupsNotice}
          onAddMember={financeApp.addGroupMember}
          onAddExpense={financeApp.addGroupExpense}
          onCreateGroup={financeApp.createGroup}
          onCreateSettlement={financeApp.createSettlement}
          onJoinByCode={financeApp.joinGroupByCode}
          onSelectGroup={financeApp.setSelectedGroupId}
          onUpdateExpense={financeApp.updateGroupExpense}
          selectedGroupData={financeApp.selectedGroupData}
          selectedGroupId={financeApp.selectedGroupId}
          selectedGroupJoinCode={financeApp.selectedGroupJoinCode}
          user={financeApp.user!}
        />
      ) : null}

      {financeApp.activeTab === 'profile' ? (
        <ProfileScreen health={financeApp.health} onLogout={financeApp.logout} user={financeApp.user!} />
      ) : null}
    </AppShell>
  );
}

export default App;
