import { describe, it, expect } from 'vitest';

import { MonthPeriod } from './month-period';

describe('MonthPeriod', () => {
  it('expone inicio (inclusive) y fin (exclusivo) del mes en UTC', () => {
    const period = MonthPeriod.of(2026, 7);

    expect(period.start.toISOString()).toBe('2026-07-01T00:00:00.000Z');
    expect(period.end.toISOString()).toBe('2026-08-01T00:00:00.000Z');
  });

  it('calcula el mes anterior cruzando el cambio de año', () => {
    const period = MonthPeriod.of(2026, 1).previous();

    expect(period.year).toBe(2025);
    expect(period.month).toBe(12);
    expect(period.start.toISOString()).toBe('2025-12-01T00:00:00.000Z');
  });

  it('rechaza meses fuera de rango', () => {
    expect(() => MonthPeriod.of(2026, 0)).toThrow();
    expect(() => MonthPeriod.of(2026, 13)).toThrow();
  });

  it('se construye desde una fecha concreta', () => {
    const period = MonthPeriod.fromDate(new Date('2026-07-15T10:30:00Z'));

    expect(period.year).toBe(2026);
    expect(period.month).toBe(7);
  });
});
