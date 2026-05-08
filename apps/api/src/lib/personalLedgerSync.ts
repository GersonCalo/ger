import { Prisma } from '@prisma/client';

const GROUP_EXPENSE_SOURCE = 'group_expense';
const GROUP_SETTLEMENT_PAID_SOURCE = 'group_settlement_paid';
const GROUP_SETTLEMENT_RECEIVED_SOURCE = 'group_settlement_received';
const GROUP_SOURCE_TYPES = [GROUP_EXPENSE_SOURCE, GROUP_SETTLEMENT_PAID_SOURCE, GROUP_SETTLEMENT_RECEIVED_SOURCE] as const;

type TransactionClient = Prisma.TransactionClient;

const buildExpenseCategory = (description: string | null) => description?.trim() || 'Gasto compartido';
const buildSettlementCategory = () => 'Liquidación de grupo';

export const syncGroupExpenseLedger = async (tx: TransactionClient, expenseId: string) => {
  const expense = await tx.groupExpense.findUnique({
    where: { id: expenseId },
    select: {
      id: true,
      groupId: true,
      amount: true,
      description: true,
      categoryId: true,
      occurredAt: true,
      group: {
        select: {
          name: true,
        },
      },
      payer: {
        select: {
          userId: true,
        },
      },
    },
  });

  await tx.personalTransaction.deleteMany({
    where: {
      sourceType: GROUP_EXPENSE_SOURCE,
      sourceRefId: expenseId,
    },
  });

  if (!expense?.payer.userId) {
    return;
  }

  await tx.personalTransaction.upsert({
    where: {
      userId_sourceType_sourceRefId: {
        userId: expense.payer.userId,
        sourceType: GROUP_EXPENSE_SOURCE,
        sourceRefId: expense.id,
      },
    },
    create: {
      userId: expense.payer.userId,
      groupId: expense.groupId,
      type: 'expense',
      sourceType: GROUP_EXPENSE_SOURCE,
      sourceRefId: expense.id,
      locked: true,
      amount: expense.amount,
      categoryId: expense.categoryId || null,
      note: expense.group.name,
      occurredAt: expense.occurredAt,
    },
    update: {
      groupId: expense.groupId,
      type: 'expense',
      locked: true,
      amount: expense.amount,
      categoryId: expense.categoryId || null,
      note: expense.group.name,
      occurredAt: expense.occurredAt,
    },
  });
};

export const syncGroupSettlementLedger = async (tx: TransactionClient, settlementId: string) => {
  const settlement = await tx.groupSettlement.findUnique({
    where: { id: settlementId },
    select: {
      id: true,
      groupId: true,
      amount: true,
      occurredAt: true,
      status: true,
      group: {
        select: {
          name: true,
        },
      },
      fromMember: {
        select: {
          userId: true,
        },
      },
      toMember: {
        select: {
          userId: true,
        },
      },
    },
  });

  await tx.personalTransaction.deleteMany({
    where: {
      sourceRefId: settlementId,
      sourceType: {
        in: [GROUP_SETTLEMENT_PAID_SOURCE, GROUP_SETTLEMENT_RECEIVED_SOURCE],
      },
    },
  });

  if (!settlement || settlement.status !== 'confirmed') {
    return;
  }

  if (settlement.fromMember.userId) {
    await tx.personalTransaction.upsert({
      where: {
        userId_sourceType_sourceRefId: {
          userId: settlement.fromMember.userId,
          sourceType: GROUP_SETTLEMENT_PAID_SOURCE,
          sourceRefId: settlement.id,
        },
      },
      create: {
        userId: settlement.fromMember.userId,
        groupId: settlement.groupId,
        type: 'expense',
        sourceType: GROUP_SETTLEMENT_PAID_SOURCE,
        sourceRefId: settlement.id,
        locked: true,
        amount: settlement.amount,
        note: settlement.group.name,
        occurredAt: settlement.occurredAt,
      },
      update: {
        groupId: settlement.groupId,
        type: 'expense',
        locked: true,
        amount: settlement.amount,
        note: settlement.group.name,
        occurredAt: settlement.occurredAt,
      },
    });
  }

  if (settlement.toMember.userId) {
    await tx.personalTransaction.upsert({
      where: {
        userId_sourceType_sourceRefId: {
          userId: settlement.toMember.userId,
          sourceType: GROUP_SETTLEMENT_RECEIVED_SOURCE,
          sourceRefId: settlement.id,
        },
      },
      create: {
        userId: settlement.toMember.userId,
        groupId: settlement.groupId,
        type: 'income',
        sourceType: GROUP_SETTLEMENT_RECEIVED_SOURCE,
        sourceRefId: settlement.id,
        locked: true,
        amount: settlement.amount,
        note: settlement.group.name,
        occurredAt: settlement.occurredAt,
      },
      update: {
        groupId: settlement.groupId,
        type: 'income',
        locked: true,
        amount: settlement.amount,
        note: settlement.group.name,
        occurredAt: settlement.occurredAt,
      },
    });
  }
};

export const syncUserGroupLedgerBackfill = async (tx: TransactionClient, userId: string) => {
  const memberships = await tx.groupMember.findMany({
    where: { userId },
    select: {
      id: true,
      groupId: true,
    },
  });

  if (memberships.length === 0) {
    await tx.personalTransaction.deleteMany({
      where: {
        userId,
        sourceType: {
          in: [...GROUP_SOURCE_TYPES],
        },
      },
    });
    return;
  }

  const groupIds = [...new Set(memberships.map((membership: { groupId: string }) => membership.groupId))];
  const memberIds = new Set(memberships.map((membership: { id: string }) => membership.id));

  const [expenses, settlements] = await Promise.all([
    tx.groupExpense.findMany({
      where: {
        groupId: { in: groupIds },
        payer: { userId },
      },
      select: {
        id: true,
      },
    }),
    tx.groupSettlement.findMany({
      where: {
        groupId: { in: groupIds },
        status: 'confirmed',
        OR: [
          { fromMemberId: { in: [...memberIds] } },
          { toMemberId: { in: [...memberIds] } },
        ],
      },
      select: {
        id: true,
      },
    }),
  ]);

  const validExpenseIds = new Set(expenses.map((expense: { id: string }) => expense.id));
  const validSettlementIds = new Set(settlements.map((settlement: { id: string }) => settlement.id));

  const existing = await tx.personalTransaction.findMany({
    where: {
      userId,
      sourceType: {
        in: [...GROUP_SOURCE_TYPES],
      },
    },
    select: {
      id: true,
      sourceType: true,
      sourceRefId: true,
    },
  });

  const staleIds = existing
    .filter((transaction: { id: string; sourceType: string; sourceRefId: string | null }) => {
      if (!transaction.sourceRefId) {
        return true;
      }

      if (transaction.sourceType === GROUP_EXPENSE_SOURCE) {
        return !validExpenseIds.has(transaction.sourceRefId);
      }

      return !validSettlementIds.has(transaction.sourceRefId);
    })
    .map((transaction: { id: string }) => transaction.id);

  if (staleIds.length) {
    await tx.personalTransaction.deleteMany({
      where: {
        id: { in: staleIds },
      },
    });
  }

  for (const expense of expenses) {
    await syncGroupExpenseLedger(tx, expense.id);
  }

  for (const settlement of settlements) {
    await syncGroupSettlementLedger(tx, settlement.id);
  }
};
