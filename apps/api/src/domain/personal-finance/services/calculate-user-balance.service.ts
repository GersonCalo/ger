import { Money } from '../value-objects/money.js';

export type PersonalTransactionInput = {
  type: 'income' | 'expense';
  amountCents: number;
};

export type GroupNetInput = {
  groupId: string;
  groupName: string;
  currency: string;
  memberId: string;
  netCents: number;
};

export type UserBalanceSummary = {
  personalIncome: number;
  personalExpense: number;
  personalBalance: number;
  groupNet: number;
  totalBalance: number;
  groupsBreakdown: Array<{
    groupId: string;
    groupName: string;
    currency: string;
    memberId: string;
    net: number;
  }>;
};

/**
 * Servicio de dominio puro: calcula el resumen financiero de un usuario a
 * partir de sus transacciones personales y del neto que le corresponde en
 * cada grupo. No conoce HTTP ni persistencia.
 *
 * Regla de negocio: un neto grupal negativo (deuda pendiente) no se resta del
 * total disponible — la salida real de dinero ya se refleja al liquidar.
 */
export const calculateUserBalanceSummary = ({
  transactions,
  groupNets,
}: {
  transactions: PersonalTransactionInput[];
  groupNets: GroupNetInput[];
}): UserBalanceSummary => {
  let income = Money.zero();
  let expense = Money.zero();

  for (const transaction of transactions) {
    const amount = Money.fromCents(transaction.amountCents);
    if (transaction.type === 'income') {
      income = income.add(amount);
    } else {
      expense = expense.add(amount);
    }
  }

  const groupNet = groupNets.reduce(
    (sum, group) => sum.add(Money.fromCents(group.netCents)),
    Money.zero()
  );

  const personalBalance = income.subtract(expense);
  const totalBalance = personalBalance.add(groupNet.orZeroIfNegative());

  return {
    personalIncome: income.toEuros(),
    personalExpense: expense.toEuros(),
    personalBalance: personalBalance.toEuros(),
    groupNet: groupNet.toEuros(),
    totalBalance: totalBalance.toEuros(),
    groupsBreakdown: groupNets.map(group => ({
      groupId: group.groupId,
      groupName: group.groupName,
      currency: group.currency,
      memberId: group.memberId,
      net: Money.fromCents(group.netCents).toEuros(),
    })),
  };
};
