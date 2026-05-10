import { useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AppShell } from '@/components/AppShell';
import { FAB } from '@/components/ui/FAB';
import { Modal } from '@/components/ui/Modal';
import { QuickGroupExpenseModal } from '@/components/ui/QuickGroupExpenseModal';
import { useToast } from '@/hooks/useToast';
import type { UseFinanceAppReturn } from '@/hooks/useFinanceApp';

type DashboardLayoutProps = {
  financeApp: UseFinanceAppReturn;
};

const routeMeta: Record<string, { title: string; subtitle: string }> = {
  '/': { title: 'Inicio', subtitle: 'Balance y actividad.' },
  '/transactions': { title: 'Movimientos', subtitle: 'Registrar y revisar.' },
  '/groups': { title: 'Grupos', subtitle: 'Compartidos.' },
  '/profile': { title: 'Perfil', subtitle: 'Cuenta y ajustes.' },
};

const FAB_ALLOWED_ROUTES = ['/', '/transactions', '/groups'];

const getRouteMeta = (pathname: string) => {
  if (pathname.startsWith('/groups/')) return routeMeta['/groups'];
  return routeMeta[pathname] || routeMeta['/'];
};

const showFabOnRoute = (pathname: string) => {
  return FAB_ALLOWED_ROUTES.includes(pathname);
};

export const DashboardLayout = ({ financeApp }: DashboardLayoutProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const toast = useToast();
  const { title, subtitle } = getRouteMeta(location.pathname);

  const [groupExpenseModalOpen, setGroupExpenseModalOpen] = useState(false);

  const handleOpenCreateTransaction = () => {
    navigate('/transactions', { state: { openCreateModal: true } });
  };

  const handleOpenGroupExpense = () => {
    setGroupExpenseModalOpen(true);
  };

  const handleOpenSettlement = () => {
    if (financeApp.selectedGroupId) {
      navigate(`/groups/${financeApp.selectedGroupId}?tab=payments`);
    } else {
      navigate('/groups');
      toast({ message: 'Selecciona un grupo para registrar una liquidación.', type: 'info' });
    }
  };

  if (!showFabOnRoute(location.pathname)) {
    return (
      <AppShell headerTitle={title} headerSubtitle={subtitle}>
        <Outlet />
      </AppShell>
    );
  }

  return (
    <AppShell headerTitle={title} headerSubtitle={subtitle}>
      <Outlet />

      <FAB
        icon={
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        }
        label="Acciones rápidas"
        actions={[
          {
            id: 'new-transaction',
            label: 'Movimiento',
            ariaLabel: 'Crear nuevo movimiento personal',
            icon: (
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M5 6h14M5 12h14M5 18h14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            ),
          },
          {
            id: 'new-group-expense',
            label: 'Gasto grupal',
            ariaLabel: 'Registrar gasto compartido en un grupo',
            icon: (
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm6 2a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM3.5 19.5a5.5 5.5 0 0 1 11 0M12.5 19.5a4.5 4.5 0 0 1 8 0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ),
          },
          {
            id: 'new-settlement',
            label: 'Liquidación',
            ariaLabel: 'Registrar liquidación de grupo',
            icon: (
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 2v20M17 7l-5-5-5 5M7 17l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ),
          },
        ]}
        onActionClick={id => {
          if (id === 'new-transaction') handleOpenCreateTransaction();
          if (id === 'new-group-expense') handleOpenGroupExpense();
          if (id === 'new-settlement') handleOpenSettlement();
        }}
      />

      <QuickGroupExpenseModal
        isOpen={groupExpenseModalOpen}
        onClose={() => setGroupExpenseModalOpen(false)}
        groups={financeApp.groups}
        categories={financeApp.categories}
        user={financeApp.user!}
        onAddExpense={financeApp.addGroupExpense}
      />
    </AppShell>
  );
};
