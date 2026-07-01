import { describe, it, expect } from 'vitest';

import { resolvePlan, canCreateGroup, getPlanLimits } from './plan-policy';

const NOW = new Date('2026-07-01T12:00:00Z');

describe('resolvePlan', () => {
  it('sin suscripción el plan es free', () => {
    expect(resolvePlan(null, NOW)).toBe('free');
  });

  it('una suscripción premium activa da plan premium', () => {
    const plan = resolvePlan(
      { plan: 'premium', status: 'active', currentPeriodEnd: new Date('2026-08-01T00:00:00Z') },
      NOW
    );

    expect(plan).toBe('premium');
  });

  it('una suscripción premium sin fecha de fin sigue activa', () => {
    expect(resolvePlan({ plan: 'premium', status: 'active', currentPeriodEnd: null }, NOW)).toBe('premium');
  });

  it('una suscripción cancelada vuelve a free', () => {
    const plan = resolvePlan(
      { plan: 'premium', status: 'canceled', currentPeriodEnd: new Date('2026-08-01T00:00:00Z') },
      NOW
    );

    expect(plan).toBe('free');
  });

  it('una suscripción caducada vuelve a free', () => {
    const plan = resolvePlan(
      { plan: 'premium', status: 'active', currentPeriodEnd: new Date('2026-06-30T00:00:00Z') },
      NOW
    );

    expect(plan).toBe('free');
  });
});

describe('canCreateGroup (PlanPolicy)', () => {
  // Scenario Gherkin HU-08.1:
  //   Given un usuario tiene plan gratuito
  //   And ya tiene un grupo activo
  //   When intenta crear otro grupo
  //   Then el sistema debe bloquear la acción
  it('bloquea al usuario free que ya tiene un grupo activo', () => {
    const result = canCreateGroup({ plan: 'free', ownedGroupsCount: 1 });

    expect(result.allowed).toBe(false);
    expect(result.limit).toBe(1);
  });

  it('permite al usuario free crear su primer grupo', () => {
    const result = canCreateGroup({ plan: 'free', ownedGroupsCount: 0 });

    expect(result.allowed).toBe(true);
  });

  it('no limita al usuario premium', () => {
    const result = canCreateGroup({ plan: 'premium', ownedGroupsCount: 25 });

    expect(result.allowed).toBe(true);
    expect(result.limit).toBeNull();
  });
});

describe('getPlanLimits', () => {
  it('expone los límites de cada plan', () => {
    expect(getPlanLimits('free').maxOwnedGroups).toBe(1);
    expect(getPlanLimits('premium').maxOwnedGroups).toBeNull();
  });
});
