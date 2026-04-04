import { AppShell } from '@/components/AppShell';
import { useFinanceApp } from '@/hooks/useFinanceApp';
import { AuthScreen } from '@/screens/AuthScreen';
import { DashboardScreen } from '@/screens/DashboardScreen';
import { GroupsScreen } from './screens/GroupsScreen';
import { ProfileScreen } from '@/screens/ProfileScreen';
import { TransactionsScreen } from '@/screens/TransactionsScreen';

const tabCopy = {
  home: {
    title: 'Inicio',
    subtitle: 'Tu dinero y tus grupos en una vista más clara.',
  },
  transactions: {
    title: 'Movimientos',
    subtitle: 'Registra y revisa tu actividad personal con menos fricción.',
  },
  groups: {
    title: 'Grupos',
    subtitle: 'Tus grupos.',
  },
  profile: {
    title: 'Perfil',
    subtitle: 'Cuenta, entorno y ajustes esenciales.',
  },
} as const;

function App() {
  const financeApp = useFinanceApp();

  if (financeApp.booting) {
    return (
      <AppShell headerTitle="Sincronizando" headerSubtitle="Recuperando tu sesión y preparando tu espacio." showNav={false}>
        <div className="screen-stack">
          <section className="section-card">
            <div className="empty-state">
              <div className="empty-state__glyph">⋯</div>
              <div className="empty-state__title">Preparando tu panel</div>
              <div className="empty-state__description">Cargando cuenta, movimientos y grupos persistidos en la API.</div>
            </div>
          </section>
        </div>
      </AppShell>
    );
  }

  if (!financeApp.isAuthenticated) {
    return (
      <AppShell
        headerTitle="Tu dinero, claro"
        headerSubtitle="Finanzas personales y grupos compartidos con una experiencia más limpia."
        showNav={false}
      >
        <AuthScreen
          busy={financeApp.authBusy}
          error={financeApp.authError}
          onLogin={financeApp.login}
          onRegister={financeApp.register}
        />
      </AppShell>
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
