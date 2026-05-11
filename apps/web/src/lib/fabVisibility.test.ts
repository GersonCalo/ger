import { describe, it, expect } from 'vitest';
import { shouldShowFab, getFabRoutePolicy, FAB_ALLOWED_ROUTES, FAB_BLOCKED_ROUTES } from './fabVisibility';

describe('shouldShowFab', () => {
  describe('route-based visibility', () => {
    it.each(FAB_ALLOWED_ROUTES)('shows FAB on allowed route %s', (route) => {
      expect(shouldShowFab(route)).toBe(true);
    });

    it.each(FAB_BLOCKED_ROUTES)('hides FAB on blocked route %s', (route) => {
      expect(shouldShowFab(route)).toBe(false);
    });

    it('hides FAB on group detail routes', () => {
      expect(shouldShowFab('/groups/abc123')).toBe(false);
      expect(shouldShowFab('/groups/1')).toBe(false);
      expect(shouldShowFab('/groups/group-with-dashes')).toBe(false);
    });

    it('hides FAB on unknown routes (safe fallback)', () => {
      expect(shouldShowFab('/unknown')).toBe(false);
      expect(shouldShowFab('/settings')).toBe(false);
      expect(shouldShowFab('')).toBe(false);
    });

    it('treats /groups list as allowed but /groups/:id as blocked', () => {
      expect(shouldShowFab('/groups')).toBe(true);
      expect(shouldShowFab('/groups/')).toBe(false);
      expect(shouldShowFab('/groups/xyz')).toBe(false);
    });
  });

  describe('state-based blocking', () => {
    const allowedPath = '/';

    it('hides FAB when quick group expense modal is open', () => {
      expect(shouldShowFab(allowedPath, { isQuickGroupExpenseModalOpen: true })).toBe(false);
    });

    it('hides FAB when transaction create modal is open', () => {
      expect(shouldShowFab(allowedPath, { isTransactionCreateOpen: true })).toBe(false);
    });

    it('hides FAB when transaction edit sheet is open', () => {
      expect(shouldShowFab(allowedPath, { isTransactionEditOpen: true })).toBe(false);
    });

    it('hides FAB when transaction delete confirm is open', () => {
      expect(shouldShowFab(allowedPath, { isTransactionDeleteConfirmOpen: true })).toBe(false);
    });

    it('hides FAB when group form (create/join) is open', () => {
      expect(shouldShowFab(allowedPath, { isGroupFormOpen: true })).toBe(false);
    });

    it('hides FAB when editing group expense', () => {
      expect(shouldShowFab(allowedPath, { isGroupExpenseEditing: true })).toBe(false);
    });

    it('hides FAB when multiple blocking states are active', () => {
      expect(
        shouldShowFab(allowedPath, {
          isTransactionCreateOpen: true,
          isQuickGroupExpenseModalOpen: true,
        })
      ).toBe(false);
    });
  });

  describe('precedence', () => {
    it('blockedStates override allowedRoutes', () => {
      expect(shouldShowFab('/transactions', { isTransactionCreateOpen: true })).toBe(false);
    });

    it('blockedRoutes override when no blocking state', () => {
      expect(shouldShowFab('/groups/123')).toBe(false);
    });

    it('allowed route with no blocking state shows FAB', () => {
      expect(shouldShowFab('/transactions', {})).toBe(true);
    });
  });

  describe('deterministic behavior', () => {
    it('returns same result for identical inputs', () => {
      const input1 = shouldShowFab('/groups', { isGroupFormOpen: false });
      const input2 = shouldShowFab('/groups', { isGroupFormOpen: false });
      expect(input1).toBe(input2);
    });

    it('is case-sensitive for routes', () => {
      expect(shouldShowFab('/Transactions')).toBe(false);
      expect(shouldShowFab('/GROUPS')).toBe(false);
    });
  });
});

describe('getFabRoutePolicy', () => {
  it('returns "allowed" for allowed routes', () => {
    expect(getFabRoutePolicy('/')).toBe('allowed');
    expect(getFabRoutePolicy('/transactions')).toBe('allowed');
    expect(getFabRoutePolicy('/groups')).toBe('allowed');
  });

  it('returns "blocked" for blocked routes', () => {
    expect(getFabRoutePolicy('/budgets')).toBe('blocked');
    expect(getFabRoutePolicy('/recurring')).toBe('blocked');
    expect(getFabRoutePolicy('/profile')).toBe('blocked');
  });

  it('returns "blocked" for group detail routes', () => {
    expect(getFabRoutePolicy('/groups/abc')).toBe('blocked');
  });

  it('returns "blocked" for unknown routes', () => {
    expect(getFabRoutePolicy('/foo')).toBe('blocked');
  });
});
