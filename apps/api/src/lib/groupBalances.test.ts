import { describe, it, expect } from 'vitest';
import {
  calculateGroupBalances,
  calculateSettlementSuggestions,
  toCents,
  fromCents,
  roundMoney,
} from './groupBalances';

const memberA = { id: 'member-a', displayName: 'Alice', weight: null };
const memberB = { id: 'member-b', displayName: 'Bob', weight: null };
const memberC = { id: 'member-c', displayName: 'Charlie', weight: null };

describe('toCents / fromCents / roundMoney', () => {
  it('converts euros to cents correctly', () => {
    expect(toCents(10)).toBe(1000);
    expect(toCents(10.5)).toBe(1050);
    expect(toCents(0.01)).toBe(1);
  });

  it('converts cents back to euros correctly', () => {
    expect(fromCents(1000)).toBe(10);
    expect(fromCents(1050)).toBe(10.5);
    expect(fromCents(1)).toBe(0.01);
  });

  it('rounds money to 2 decimals', () => {
    expect(roundMoney(10.005)).toBe(10.01);
    expect(roundMoney(10.004)).toBe(10);
    expect(roundMoney(3.333333)).toBe(3.33);
  });
});

describe('calculateGroupBalances', () => {
  it('returns zero balances for empty group with no expenses', () => {
    const balances = calculateGroupBalances({
      members: [memberA, memberB],
      expenses: [],
      settlements: [],
    });

    expect(balances).toHaveLength(2);
    for (const b of balances) {
      expect(b.paid).toBe(0);
      expect(b.owes).toBe(0);
      expect(b.net).toBe(0);
    }
  });

  it('calculates equal split: 2 members, 100 paid by A', () => {
    const balances = calculateGroupBalances({
      members: [memberA, memberB],
      expenses: [
        {
          id: 'exp-1',
          payerMemberId: 'member-a',
          amount: 100,
          splitMethod: 'equal',
          splits: [],
        },
      ],
      settlements: [],
    });

    const a = balances.find((b) => b.memberId === 'member-a')!;
    const b = balances.find((b) => b.memberId === 'member-b')!;

    expect(a.paid).toBe(100);
    expect(a.owes).toBe(50);
    expect(a.net).toBe(50);
    expect(b.paid).toBe(0);
    expect(b.owes).toBe(50);
    expect(b.net).toBe(-50);
  });

  it('handles 99.99 split among 3 members without losing cents', () => {
    const balances = calculateGroupBalances({
      members: [memberA, memberB, memberC],
      expenses: [
        {
          id: 'exp-1',
          payerMemberId: 'member-a',
          amount: 99.99,
          splitMethod: 'equal',
          splits: [],
        },
      ],
      settlements: [],
    });

    const totalOwesCents = balances.reduce((sum, b) => sum + b.netCents, 0);
    expect(totalOwesCents).toBe(0);

    const owesTotal = balances.reduce((sum, b) => sum + b.owes, 0);
    expect(roundMoney(owesTotal)).toBe(99.99);
  });

  it('handles 10.00 split among 3 members: 3.34 + 3.33 + 3.33', () => {
    const balances = calculateGroupBalances({
      members: [memberA, memberB, memberC],
      expenses: [
        {
          id: 'exp-1',
          payerMemberId: 'member-a',
          amount: 10,
          splitMethod: 'equal',
          splits: [],
        },
      ],
      settlements: [],
    });

    const a = balances.find((b) => b.memberId === 'member-a')!;
    const b = balances.find((b) => b.memberId === 'member-b')!;
    const c = balances.find((b) => b.memberId === 'member-c')!;

    expect(a.paid).toBe(10);
    expect(a.owes).toBeCloseTo(3.34, 2);
    expect(a.net).toBeCloseTo(6.66, 2);

    expect(b.owes).toBeCloseTo(3.33, 2);
    expect(b.net).toBeCloseTo(-3.33, 2);

    expect(c.owes).toBeCloseTo(3.33, 2);
    expect(c.net).toBeCloseTo(-3.33, 2);

    const totalNetCents = balances.reduce((sum, b) => sum + b.netCents, 0);
    expect(totalNetCents).toBe(0);
  });

  it('handles multiple expenses and a confirmed settlement', () => {
    const balances = calculateGroupBalances({
      members: [memberA, memberB],
      expenses: [
        {
          id: 'exp-1',
          payerMemberId: 'member-a',
          amount: 100,
          splitMethod: 'equal',
          splits: [],
        },
        {
          id: 'exp-2',
          payerMemberId: 'member-b',
          amount: 40,
          splitMethod: 'equal',
          splits: [],
        },
      ],
      settlements: [
        {
          fromMemberId: 'member-b',
          toMemberId: 'member-a',
          amount: 30,
          status: 'confirmed',
        },
      ],
    });

    const a = balances.find((b) => b.memberId === 'member-a')!;
    const b = balances.find((b) => b.memberId === 'member-b')!;

    expect(a.paid).toBe(100);
    expect(a.owes).toBe(70);
    expect(a.settledIn).toBe(30);
    expect(a.net).toBe(0);

    expect(b.paid).toBe(40);
    expect(b.owes).toBe(70);
    expect(b.settledOut).toBe(30);
    expect(b.net).toBe(0);
  });

  it('ignores cancelled settlements', () => {
    const balances = calculateGroupBalances({
      members: [memberA, memberB],
      expenses: [
        {
          id: 'exp-1',
          payerMemberId: 'member-a',
          amount: 100,
          splitMethod: 'equal',
          splits: [],
        },
      ],
      settlements: [
        {
          fromMemberId: 'member-b',
          toMemberId: 'member-a',
          amount: 50,
          status: 'cancelled',
        },
      ],
    });

    const a = balances.find((b) => b.memberId === 'member-a')!;
    const b = balances.find((b) => b.memberId === 'member-b')!;

    expect(a.settledIn).toBe(0);
    expect(b.settledOut).toBe(0);
    expect(a.net).toBe(50);
    expect(b.net).toBe(-50);
  });

  it('respects manual split exact amounts', () => {
    const balances = calculateGroupBalances({
      members: [memberA, memberB, memberC],
      expenses: [
        {
          id: 'exp-1',
          payerMemberId: 'member-a',
          amount: 100,
          splitMethod: 'manual',
          splits: [
            { memberId: 'member-a', shareAmount: 50 },
            { memberId: 'member-b', shareAmount: 30 },
            { memberId: 'member-c', shareAmount: 20 },
          ],
        },
      ],
      settlements: [],
    });

    const a = balances.find((b) => b.memberId === 'member-a')!;
    const b = balances.find((b) => b.memberId === 'member-b')!;
    const c = balances.find((b) => b.memberId === 'member-c')!;

    expect(a.paid).toBe(100);
    expect(a.owes).toBe(50);
    expect(a.net).toBe(50);
    expect(b.owes).toBe(30);
    expect(b.net).toBe(-30);
    expect(c.owes).toBe(20);
    expect(c.net).toBe(-20);
  });

  it('ignores proposed settlements', () => {
    const balances = calculateGroupBalances({
      members: [memberA, memberB],
      expenses: [
        {
          id: 'exp-1',
          payerMemberId: 'member-a',
          amount: 60,
          splitMethod: 'equal',
          splits: [],
        },
      ],
      settlements: [
        {
          fromMemberId: 'member-b',
          toMemberId: 'member-a',
          amount: 30,
          status: 'proposed',
        },
      ],
    });

    const a = balances.find((b) => b.memberId === 'member-a')!;
    expect(a.settledIn).toBe(0);
    expect(a.net).toBe(30);
  });

  it('handles weighted split with explicit weights', () => {
    const weightedA = { id: 'member-a', displayName: 'Alice', weight: 2 };
    const weightedB = { id: 'member-b', displayName: 'Bob', weight: 1 };

    const balances = calculateGroupBalances({
      members: [weightedA, weightedB],
      expenses: [
        {
          id: 'exp-1',
          payerMemberId: 'member-a',
          amount: 90,
          splitMethod: 'weights',
          splits: [],
        },
      ],
      settlements: [],
    });

    const a = balances.find((b) => b.memberId === 'member-a')!;
    const b = balances.find((b) => b.memberId === 'member-b')!;

    expect(a.paid).toBe(90);
    expect(a.owes).toBe(60);
    expect(a.net).toBe(30);
    expect(b.owes).toBe(30);
    expect(b.net).toBe(-30);
  });

  it('handles weighted split with null weights defaulting to 1', () => {
    const balances = calculateGroupBalances({
      members: [memberA, memberB],
      expenses: [
        {
          id: 'exp-1',
          payerMemberId: 'member-a',
          amount: 100,
          splitMethod: 'weights',
          splits: [],
        },
      ],
      settlements: [],
    });

    const a = balances.find((b) => b.memberId === 'member-a')!;
    const b = balances.find((b) => b.memberId === 'member-b')!;

    expect(a.paid).toBe(100);
    expect(a.owes).toBe(50);
    expect(a.net).toBe(50);
    expect(b.owes).toBe(50);
    expect(b.net).toBe(-50);
  });

  it('handles weighted split with zero weight defaulting to 1', () => {
    const zeroWeight = { id: 'member-a', displayName: 'Alice', weight: 0 };
    const normalB = { id: 'member-b', displayName: 'Bob', weight: 1 };

    const balances = calculateGroupBalances({
      members: [zeroWeight, normalB],
      expenses: [
        {
          id: 'exp-1',
          payerMemberId: 'member-a',
          amount: 60,
          splitMethod: 'weights',
          splits: [],
        },
      ],
      settlements: [],
    });

    const a = balances.find((b) => b.memberId === 'member-a')!;
    const b = balances.find((b) => b.memberId === 'member-b')!;

    expect(a.paid).toBe(60);
    expect(a.owes).toBe(30);
    expect(a.net).toBe(30);
    expect(b.owes).toBe(30);
    expect(b.net).toBe(-30);
  });

  it('handles weighted split with 3 members and closing cents', () => {
    const wA = { id: 'member-a', displayName: 'Alice', weight: 3 };
    const wB = { id: 'member-b', displayName: 'Bob', weight: 2 };
    const wC = { id: 'member-c', displayName: 'Charlie', weight: 1 };

    const balances = calculateGroupBalances({
      members: [wA, wB, wC],
      expenses: [
        {
          id: 'exp-1',
          payerMemberId: 'member-a',
          amount: 100,
          splitMethod: 'weights',
          splits: [],
        },
      ],
      settlements: [],
    });

    const totalOwesCents = balances.reduce((sum, b) => sum + b.netCents, 0);
    expect(totalOwesCents).toBe(0);
  });

  it('handles settlement with unknown member gracefully', () => {
    const balances = calculateGroupBalances({
      members: [memberA],
      expenses: [],
      settlements: [
        {
          fromMemberId: 'unknown-from',
          toMemberId: 'unknown-to',
          amount: 50,
          status: 'confirmed',
        },
      ],
    });

    expect(balances).toHaveLength(1);
    expect(balances[0].settledIn).toBe(0);
    expect(balances[0].settledOut).toBe(0);
  });

  it('handles expense with payer not in members list', () => {
    const balances = calculateGroupBalances({
      members: [memberA, memberB],
      expenses: [
        {
          id: 'exp-1',
          payerMemberId: 'unknown-payer',
          amount: 100,
          splitMethod: 'equal',
          splits: [],
        },
      ],
      settlements: [],
    });

    const a = balances.find((b) => b.memberId === 'member-a')!;
    expect(a.paid).toBe(0);
    expect(a.owes).toBe(50);
  });

  it('handles single member group with equal split', () => {
    const balances = calculateGroupBalances({
      members: [memberA],
      expenses: [
        {
          id: 'exp-1',
          payerMemberId: 'member-a',
          amount: 50,
          splitMethod: 'equal',
          splits: [],
        },
      ],
      settlements: [],
    });

    const a = balances.find((b) => b.memberId === 'member-a')!;
    expect(a.paid).toBe(50);
    expect(a.owes).toBe(50);
    expect(a.net).toBe(0);
  });

  it('handles negative weight defaulting to 1', () => {
    const negWeight = { id: 'member-a', displayName: 'Alice', weight: -5 };
    const normalB = { id: 'member-b', displayName: 'Bob', weight: 1 };

    const balances = calculateGroupBalances({
      members: [negWeight, normalB],
      expenses: [
        {
          id: 'exp-1',
          payerMemberId: 'member-a',
          amount: 80,
          splitMethod: 'weights',
          splits: [],
        },
      ],
      settlements: [],
    });

    const a = balances.find((b) => b.memberId === 'member-a')!;
    const b = balances.find((b) => b.memberId === 'member-b')!;

    expect(a.paid).toBe(80);
    expect(a.owes).toBe(40);
    expect(b.owes).toBe(40);
  });
});

describe('calculateSettlementSuggestions', () => {
  it('suggests minimum payment to settle debts', () => {
    const balances = [
      { memberId: 'a', memberName: 'Alice', netCents: 5000 },
      { memberId: 'b', memberName: 'Bob', netCents: -3000 },
      { memberId: 'c', memberName: 'Charlie', netCents: -2000 },
    ];

    const suggestions = calculateSettlementSuggestions(balances);

    expect(suggestions).toHaveLength(2);
    const totalAmount = suggestions.reduce((sum, s) => sum + s.amount, 0);
    expect(roundMoney(totalAmount)).toBe(50);
  });

  it('returns empty suggestions when all members are settled', () => {
    const balances = [
      { memberId: 'a', memberName: 'Alice', netCents: 0 },
      { memberId: 'b', memberName: 'Bob', netCents: 0 },
    ];

    const suggestions = calculateSettlementSuggestions(balances);
    expect(suggestions).toHaveLength(0);
  });

  it('returns empty suggestions for empty balances', () => {
    const suggestions = calculateSettlementSuggestions([]);
    expect(suggestions).toHaveLength(0);
  });

  it('returns empty when only creditors exist', () => {
    const balances = [
      { memberId: 'a', memberName: 'Alice', netCents: 1000 },
      { memberId: 'b', memberName: 'Bob', netCents: 500 },
    ];

    const suggestions = calculateSettlementSuggestions(balances);
    expect(suggestions).toHaveLength(0);
  });

  it('returns empty when only debtors exist', () => {
    const balances = [
      { memberId: 'a', memberName: 'Alice', netCents: -1000 },
      { memberId: 'b', memberName: 'Bob', netCents: -500 },
    ];

    const suggestions = calculateSettlementSuggestions(balances);
    expect(suggestions).toHaveLength(0);
  });

  it('handles single debtor and single creditor', () => {
    const balances = [
      { memberId: 'a', memberName: 'Alice', netCents: 2500 },
      { memberId: 'b', memberName: 'Bob', netCents: -2500 },
    ];

    const suggestions = calculateSettlementSuggestions(balances);
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].fromMemberId).toBe('b');
    expect(suggestions[0].toMemberId).toBe('a');
    expect(suggestions[0].amount).toBe(25);
  });
});
