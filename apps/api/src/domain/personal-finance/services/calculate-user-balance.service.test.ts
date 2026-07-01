import { describe, it, expect } from 'vitest';

import { calculateUserBalanceSummary } from './calculate-user-balance.service';

describe('calculateUserBalanceSummary (servicio de dominio puro)', () => {
  it('devuelve ceros sin transacciones ni grupos', () => {
    const result = calculateUserBalanceSummary({ transactions: [], groupNets: [] });

    expect(result.personalIncome).toBe(0);
    expect(result.personalExpense).toBe(0);
    expect(result.personalBalance).toBe(0);
    expect(result.groupNet).toBe(0);
    expect(result.totalBalance).toBe(0);
    expect(result.groupsBreakdown).toEqual([]);
  });

  // Scenario Gherkin HU-00.1:
  //   Given un usuario con ingresos de 1500 euros
  //   And gastos manuales de 400 euros
  //   And saldo grupal positivo de 60 euros
  //   When el sistema calcula su resumen financiero
  //   Then el disponible personal debe ser 1100 euros
  //   And el total recuperable debe incluir los 60 euros pendientes de grupos
  it('calcula el resumen financiero con saldo grupal positivo', () => {
    const result = calculateUserBalanceSummary({
      transactions: [
        { type: 'income', amountCents: 150000 },
        { type: 'expense', amountCents: 40000 },
      ],
      groupNets: [
        {
          groupId: 'group-1',
          groupName: 'Piso compartido',
          currency: 'EUR',
          memberId: 'member-1',
          netCents: 6000,
        },
      ],
    });

    expect(result.personalBalance).toBe(1100);
    expect(result.groupNet).toBe(60);
    expect(result.totalBalance).toBe(1160);
    expect(result.groupsBreakdown).toEqual([
      {
        groupId: 'group-1',
        groupName: 'Piso compartido',
        currency: 'EUR',
        memberId: 'member-1',
        net: 60,
      },
    ]);
  });

  it('no resta del total un saldo grupal negativo (deuda ya reflejada en gastos futuros)', () => {
    const result = calculateUserBalanceSummary({
      transactions: [{ type: 'income', amountCents: 100000 }],
      groupNets: [
        {
          groupId: 'group-1',
          groupName: 'Viaje',
          currency: 'EUR',
          memberId: 'member-1',
          netCents: -2500,
        },
      ],
    });

    expect(result.groupNet).toBe(-25);
    expect(result.totalBalance).toBe(1000);
  });

  it('suma los netos de varios grupos', () => {
    const result = calculateUserBalanceSummary({
      transactions: [],
      groupNets: [
        { groupId: 'g1', groupName: 'A', currency: 'EUR', memberId: 'm1', netCents: 3000 },
        { groupId: 'g2', groupName: 'B', currency: 'EUR', memberId: 'm2', netCents: -1000 },
      ],
    });

    expect(result.groupNet).toBe(20);
    expect(result.totalBalance).toBe(20);
    expect(result.groupsBreakdown).toHaveLength(2);
  });

  it('evita errores de coma flotante acumulando en céntimos', () => {
    const result = calculateUserBalanceSummary({
      transactions: [
        { type: 'expense', amountCents: 10 },
        { type: 'expense', amountCents: 20 },
        { type: 'income', amountCents: 100 },
      ],
      groupNets: [],
    });

    expect(result.personalExpense).toBe(0.3);
    expect(result.personalBalance).toBe(0.7);
  });
});
