import { describe, it, expect } from 'vitest';

import { Money } from './money';

describe('Money', () => {
  it('creates from euros and exposes cents', () => {
    const money = Money.fromEuros(12.34);

    expect(money.cents).toBe(1234);
    expect(money.toEuros()).toBe(12.34);
  });

  it('rounds floating point euros to the nearest cent', () => {
    // 19.99 * 100 = 1998.9999999999998 en aritmética flotante
    expect(Money.fromEuros(19.99).cents).toBe(1999);
    expect(Money.fromEuros(0.1).add(Money.fromEuros(0.2)).toEuros()).toBe(0.3);
  });

  it('creates from cents', () => {
    expect(Money.fromCents(250).toEuros()).toBe(2.5);
  });

  it('rejects non-integer cents', () => {
    expect(() => Money.fromCents(10.5)).toThrow();
  });

  it('adds and subtracts immutably', () => {
    const base = Money.fromEuros(100);
    const result = base.add(Money.fromEuros(50)).subtract(Money.fromEuros(30.5));

    expect(result.toEuros()).toBe(119.5);
    expect(base.toEuros()).toBe(100);
  });

  it('supports negative amounts and zero clamping', () => {
    const debt = Money.fromEuros(10).subtract(Money.fromEuros(25));

    expect(debt.toEuros()).toBe(-15);
    expect(debt.isNegative()).toBe(true);
    expect(debt.orZeroIfNegative().toEuros()).toBe(0);
    expect(Money.zero().toEuros()).toBe(0);
  });
});
