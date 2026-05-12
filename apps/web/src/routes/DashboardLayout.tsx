import { createContext, useCallback, useContext, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AppShell } from '@/components/AppShell';
import { FAB } from '@/components/ui/FAB';
import { Modal } from '@/components/ui/Modal';
import { QuickGroupExpenseModal } from '@/components/ui/QuickGroupExpenseModal';
import { getRouteMeta, shouldShowFab, type FabUiState } from '@/lib/navigation';
import { useToast } from '@/hooks/useToast';
import type { UseFinanceAppReturn } from '@/hooks/useFinanceApp';

type DashboardLayoutProps = {
  financeApp: UseFinanceAppReturn;
};

type OutletContextValue = {
  setFabBlockedState: (state: Partial<FabUiState>) => void;
};

export const useFabBlockedState = () => {
  const context = useContext<OutletContextValue | null>(FabOutletContext);
  if (!context) {
    throw new Error('useFabBlockedState must be used within DashboardLayout');
  }
  return context;
};

const FabOutletContext = createContext<OutletContextValue | null>(null);

export const DashboardLayout = ({ financeApp }: DashboardLayoutProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { title, subtitle } = getRouteMeta(location.pathname);

  const [groupExpenseModalOpen, setGroupExpenseModalOpen] = useState(false);
  const [fabBlockedState, setFabBlockedStateRaw] = useState<FabUiState>({});

  const setFabBlockedState = useCallback((state: Partial<FabUiState>) => {
    setFabBlockedStateRaw(prev => ({ ...prev, ...state }));
  }, []);

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
      showToast({ message: 'Selecciona un grupo para registrar una liquidación.', type: 'info' });
    }
  };

  const fabUiState: FabUiState = {
    ...fabBlockedState,
    isQuickGroupExpenseModalOpen: groupExpenseModalOpen,
  };

  const fabVisible = shouldShowFab(location.pathname, fabUiState);

  return (
    <FabOutletContext.Provider value={{ setFabBlockedState }}>
      <AppShell headerTitle={title} headerSubtitle={subtitle}>
        <Outlet context={{ setFabBlockedState } satisfies OutletContextValue} />

        <div className={fabVisible ? 'fab' : 'fab fab--hidden'}>
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
        </div>

        <QuickGroupExpenseModal
          isOpen={groupExpenseModalOpen}
          onClose={() => setGroupExpenseModalOpen(false)}
          groups={financeApp.groups}
          categories={financeApp.categories}
          user={financeApp.user!}
          onAddExpense={financeApp.addGroupExpense}
        />
      </AppShell>
    </FabOutletContext.Provider>
  );
};
