import { Navigate, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from './ProtectedRoute';
import { DashboardLayout } from './DashboardLayout';
import { AppShell } from '@/components/AppShell';
import { DashboardScreen } from '@/screens/DashboardScreen';
import { TransactionsScreen } from '@/screens/TransactionsScreen';
import { GroupsScreen } from '@/screens/GroupsScreen';
import { GroupDetailScreen } from '@/screens/GroupDetailScreen';
import { ProfileScreen } from '@/screens/ProfileScreen';
import { AuthScreen } from '@/screens/AuthScreen';
import type { UseFinanceAppReturn } from '@/hooks/useFinanceApp';

type AppRoutesProps = {
  financeApp: UseFinanceAppReturn;
};

export const AppRoutes = ({ financeApp }: AppRoutesProps) => {
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
        headerSubtitle="Finanzas personales y gastos compartidos en una experiencia serena."
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
    <Routes>
      <Route element={<ProtectedRoute isAuthenticated={financeApp.isAuthenticated} booting={financeApp.booting} />}>
        <Route element={<DashboardLayout />}>
          <Route
            index
            element={
              <DashboardScreen
                groups={financeApp.groups}
                onGoToGroups={() => financeApp.setActiveTab('groups')}
                onGoToTransactions={() => financeApp.setActiveTab('transactions')}
                summary={financeApp.dashboardSummary}
                transactions={financeApp.transactions}
                user={financeApp.user!}
              />
            }
          />
          <Route
            path="transactions"
            element={
              <TransactionsScreen
                busy={financeApp.dataBusy}
                error={financeApp.transactionError}
                onCreateTransaction={financeApp.createTransaction}
                onUpdateTransaction={financeApp.updateTransaction}
                onDeleteTransaction={financeApp.deleteTransaction}
                onCreateCategory={financeApp.createCategory}
                onRefresh={financeApp.refreshTransactions}
                onApplyFilters={financeApp.applyTransactionFilters}
                onLoadMore={financeApp.loadMoreTransactions}
                onExportCsv={financeApp.exportTransactionsCsv}
                summary={financeApp.dashboardSummary}
                transactions={financeApp.transactions}
                user={financeApp.user!}
                categories={financeApp.categories}
                filters={financeApp.transactionFilters}
                hasMore={financeApp.txHasMore}
                loadingMore={financeApp.txLoadingMore}
              />
            }
          />
          <Route
            path="groups"
            element={
              <GroupsScreen
                error={financeApp.groupsError}
                groups={financeApp.groups}
                groupsBusy={financeApp.groupsBusy}
                onAddMember={financeApp.addGroupMember}
                onDeleteMember={financeApp.deleteGroupMember}
                onAddExpense={financeApp.addGroupExpense}
                onCreateGroup={financeApp.createGroup}
                onCreateSettlement={financeApp.createSettlement}
                onJoinByCode={financeApp.joinGroupByCode}
                onSelectGroup={financeApp.setSelectedGroupId}
                onUpdateExpense={financeApp.updateGroupExpense}
                onCreateGroupCategory={financeApp.createGroupCategory}
                onUpdateGroupCategory={financeApp.updateGroupCategory}
                onDeleteGroupCategory={financeApp.deleteGroupCategory}
                selectedGroupData={financeApp.selectedGroupData}
                selectedGroupId={financeApp.selectedGroupId}
                selectedGroupJoinCode={financeApp.selectedGroupJoinCode}
                user={financeApp.user!}
                categories={financeApp.categories}
              />
            }
          />
          <Route
            path="groups/:groupId"
            element={
              <GroupDetailScreen
                financeApp={financeApp}
              />
            }
          />
          <Route
            path="profile"
            element={
              <ProfileScreen
                health={financeApp.health}
                onLogout={financeApp.logout}
                user={financeApp.user!}
                categories={financeApp.categories}
                categoriesBusy={financeApp.categoriesBusy}
                onCreateCategory={financeApp.createCategory}
                onUpdateCategory={financeApp.updateCategory}
                onDeleteCategory={financeApp.deleteCategory}
                isPushEnabled={financeApp.isPushEnabled}
                isPushSupported={financeApp.isPushSupported}
                onSubscribeToPush={financeApp.subscribeToPush}
                onUnsubscribeFromPush={financeApp.unsubscribeFromPush}
                theme={financeApp.theme}
                onSetTheme={financeApp.setTheme}
              />
            }
          />
        </Route>
      </Route>
      <Route
        path="/auth"
        element={
          financeApp.isAuthenticated ? (
            <Navigate to="/" replace />
          ) : (
            <AppShell
              headerTitle="Tu dinero, claro"
              headerSubtitle="Finanzas personales y gastos compartidos en una experiencia serena."
              showNav={false}
            >
              <AuthScreen
                busy={financeApp.authBusy}
                error={financeApp.authError}
                onLogin={financeApp.login}
                onRegister={financeApp.register}
              />
            </AppShell>
          )
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};
