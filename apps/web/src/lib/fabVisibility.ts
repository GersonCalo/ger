/**
 * FAB Visibility Policy
 *
 * Centralized, testable policy that decides whether the Floating Action Button
 * should be visible based on route and UI context.
 *
 * Matrix:
 * ┌─────────────────────────────────┬──────────┬──────────────────────────────┐
 * │ Ruta / Estado                   │ Visible? │ Razón                        │
 * ├─────────────────────────────────┼──────────┼──────────────────────────────┤
 * │ /                               │ SÍ       │ Ruta permitida, sin bloqueo  │
 * │ /transactions                   │ SÍ       │ Ruta permitida, sin bloqueo  │
 * │ /groups                         │ SÍ       │ Ruta permitida, sin bloqueo  │
 * │ /groups/:groupId                │ NO       │ Ruta bloqueada (detalle)     │
 * │ /budgets                        │ NO       │ Ruta bloqueada               │
 * │ /recurring                      │ NO       │ Ruta bloqueada               │
 * │ /profile                        │ NO       │ Ruta bloqueada               │
 * │ /auth                           │ NO       │ Ruta bloqueada               │
 * │ Cualquier otra                  │ NO       │ Fallback seguro              │
 * ├─────────────────────────────────┼──────────┼──────────────────────────────┤
 * │ Bloqueos por estado (cualquiera)│          │                              │
 * │  isQuickGroupExpenseModalOpen   │ NO       │ Modal de creación grupal     │
 * │  isTransactionCreateOpen        │ NO       │ Modal crear movimiento       │
 * │  isTransactionEditOpen          │ NO       │ Sheet editar movimiento      │
 * │  isTransactionDeleteConfirmOpen │ NO       │ Confirmación destructiva     │
 * │  isGroupFormOpen                │ NO       │ Form inline crear/unir grupo │
 * │  isGroupExpenseEditing          │ NO       │ Editando gasto grupal        │
 * └─────────────────────────────────┴──────────┴──────────────────────────────┘
 *
 * Precedencia: blockedStates > blockedRoutes > allowedRoutes
 */

export type FabUiState = {
  isQuickGroupExpenseModalOpen?: boolean;
  isTransactionCreateOpen?: boolean;
  isTransactionEditOpen?: boolean;
  isTransactionDeleteConfirmOpen?: boolean;
  isGroupFormOpen?: boolean;
  isGroupExpenseEditing?: boolean;
};

export const FAB_ALLOWED_ROUTES = ['/', '/transactions', '/groups'] as const;
export const FAB_BLOCKED_ROUTES = ['/budgets', '/recurring', '/profile'] as const;

const isGroupDetailRoute = (pathname: string): boolean => {
  return /^\/groups\/[^/]+$/.test(pathname);
};

const isBlockedRoute = (pathname: string): boolean => {
  if (isGroupDetailRoute(pathname)) return true;
  return (FAB_BLOCKED_ROUTES as readonly string[]).includes(pathname);
};

const isAllowedRoute = (pathname: string): boolean => {
  return (FAB_ALLOWED_ROUTES as readonly string[]).includes(pathname);
};

const hasBlockingState = (uiState?: FabUiState): boolean => {
  if (!uiState) return false;
  return (
    !!uiState.isQuickGroupExpenseModalOpen ||
    !!uiState.isTransactionCreateOpen ||
    !!uiState.isTransactionEditOpen ||
    !!uiState.isTransactionDeleteConfirmOpen ||
    !!uiState.isGroupFormOpen ||
    !!uiState.isGroupExpenseEditing
  );
};

export const shouldShowFab = (
  pathname: string,
  uiState?: FabUiState
): boolean => {
  if (hasBlockingState(uiState)) return false;
  if (isBlockedRoute(pathname)) return false;
  return isAllowedRoute(pathname);
};

export const getFabRoutePolicy = (pathname: string): 'allowed' | 'blocked' => {
  if (isBlockedRoute(pathname)) return 'blocked';
  if (isAllowedRoute(pathname)) return 'allowed';
  return 'blocked';
};
