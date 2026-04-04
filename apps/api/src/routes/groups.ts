import type { Prisma } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import { calculateGroupBalances, calculateSettlementSuggestions } from '../lib/groupBalances.js';
import {
  serializeGroupExpense,
  serializeGroupMember,
  serializeGroupSettlement,
  serializeGroupSummary,
} from '../lib/groupSerializers.js';
import { prisma } from '../db/prisma.js';
import { requireAuth } from '../middlewares/requireAuth.js';

export const groupsRouter = Router();

const positiveAmountSchema = z.union([z.number().positive(), z.string().min(1)]);

const numberFromUnknown = (value: unknown) => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return Number(value);
  return Number.NaN;
};

const normalizeAmount = (value: unknown) => {
  const amount = numberFromUnknown(value);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
};

const normalizeWeight = (value: unknown) => {
  if (value == null || value === '') return null;
  const weight = numberFromUnknown(value);
  return Number.isFinite(weight) && weight > 0 ? weight : null;
};

const normalizeOccurredAt = (value?: string) => {
  if (!value) return new Date();
  const occurredAt = new Date(value);
  return Number.isNaN(occurredAt.getTime()) ? null : occurredAt;
};

const groupMemberInputSchema = z
  .object({
    userId: z.string().uuid().optional(),
    displayName: z.string().trim().min(1).optional(),
    weight: z.union([z.number().positive(), z.string().min(1)]).nullable().optional(),
    role: z.enum(['member', 'admin']).optional(),
  })
  .superRefine((value, ctx) => {
    if (!value.userId && !value.displayName) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Debes indicar userId o displayName',
      });
    }
  });

const createGroupSchema = z.object({
  name: z.string().trim().min(1),
  currency: z.string().trim().min(1).optional(),
  members: z.array(groupMemberInputSchema).optional(),
});

const updateMemberSchema = z
  .object({
    displayName: z.string().trim().min(1).optional(),
    weight: z.union([z.number().positive(), z.string().min(1)]).nullable().optional(),
    role: z.enum(['member', 'admin']).optional(),
  })
  .refine(value => Object.keys(value).length > 0, {
    message: 'No hay cambios para actualizar',
  });

const expenseSchema = z.object({
  payerMemberId: z.string().uuid(),
  amount: positiveAmountSchema,
  description: z.string().trim().optional(),
  occurredAt: z.string().datetime().optional(),
  splitMethod: z.enum(['equal', 'weights']),
});

const settlementSchema = z.object({
  fromMemberId: z.string().uuid(),
  toMemberId: z.string().uuid(),
  amount: positiveAmountSchema,
  occurredAt: z.string().datetime().optional(),
});

const updateSettlementSchema = z.object({
  status: z.enum(['confirmed', 'cancelled']),
});

type RouteError = {
  status: number;
  body: {
    message: string;
  };
};

const getAccessibleGroup = async (groupId: string, userId: string) => {
  return prisma.group.findFirst({
    where: {
      id: groupId,
      OR: [{ ownerUserId: userId }, { members: { some: { userId } } }],
    },
    select: {
      id: true,
      ownerUserId: true,
      currency: true,
      members: {
        select: {
          id: true,
          userId: true,
          displayName: true,
          weight: true,
          role: true,
        },
        orderBy: { id: 'asc' },
      },
    },
  });
};

const getAdminGroup = async (groupId: string, userId: string) => {
  const group = await prisma.group.findFirst({
    where: {
      id: groupId,
      OR: [
        { ownerUserId: userId },
        {
          members: {
            some: {
              userId,
              role: 'admin',
            },
          },
        },
      ],
    },
    select: {
      id: true,
      ownerUserId: true,
      currency: true,
      members: {
        select: {
          id: true,
          userId: true,
          displayName: true,
          weight: true,
          role: true,
        },
        orderBy: { id: 'asc' },
      },
    },
  });

  return group;
};

type AccessibleGroup = NonNullable<Awaited<ReturnType<typeof getAccessibleGroup>>>;
type AdminGroup = NonNullable<Awaited<ReturnType<typeof getAdminGroup>>>;

const assertAccessibleGroup = async (groupId: string, userId: string) => {
  const group = await getAccessibleGroup(groupId, userId);
  if (!group) {
    return {
      error: { status: 404, body: { message: 'Grupo no encontrado' } } as RouteError,
    } as { error: RouteError; group?: never };
  }

  return { group } as { group: AccessibleGroup; error?: never };
};

const assertAdminGroup = async (groupId: string, userId: string) => {
  const group = await getAdminGroup(groupId, userId);
  if (!group) {
    return {
      error: { status: 403, body: { message: 'No autorizado para administrar este grupo' } } as RouteError,
    } as { error: RouteError; group?: never };
  }

  return { group } as { group: AdminGroup; error?: never };
};

const resolveMemberDisplayName = async (input: z.infer<typeof groupMemberInputSchema>) => {
  if (input.userId) {
    const user = await prisma.user.findUnique({
      where: { id: input.userId },
      select: { name: true, email: true },
    });

    if (!user) {
      return {
        error: { status: 400, body: { message: 'El usuario indicado no existe' } } as RouteError,
      } as { error: RouteError; displayName?: never };
    }

    return {
      displayName: input.displayName?.trim() || user.name?.trim() || user.email,
    } as { displayName: string; error?: never };
  }

  return {
    displayName: input.displayName!.trim(),
  } as { displayName: string; error?: never };
};

const buildExpenseSplits = (
  amount: number,
  splitMethod: 'equal' | 'weights',
  members: Array<{ id: string; weight: { toString(): string } | null }>
) => {
  const memberIds = [...members].sort((a, b) => a.id.localeCompare(b.id));
  const amountCents = Math.round(amount * 100);

  if (splitMethod === 'equal') {
    const baseShare = Math.floor(amountCents / (memberIds.length || 1));
    let remainder = amountCents - baseShare * memberIds.length;

    return memberIds.map(member => {
      const shareCents = baseShare + (remainder > 0 ? 1 : 0);
      remainder = Math.max(0, remainder - 1);

      return {
        memberId: member.id,
        shareAmount: shareCents / 100,
        shareWeight: null,
      };
    });
  }

  const weights = memberIds.map(member => {
    const value = member.weight == null ? 1 : Number(member.weight.toString());
    return Number.isFinite(value) && value > 0 ? value : 1;
  });
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0) || memberIds.length || 1;

  let assigned = 0;

  return memberIds.map((member, index) => {
    if (index === memberIds.length - 1) {
      const shareCents = amountCents - assigned;
      return {
        memberId: member.id,
        shareAmount: shareCents / 100,
        shareWeight: weights[index],
      };
    }

    const shareCents = Math.floor((amountCents * weights[index]) / totalWeight);
    assigned += shareCents;

    return {
      memberId: member.id,
      shareAmount: shareCents / 100,
      shareWeight: weights[index],
    };
  });
};

groupsRouter.get('/groups', requireAuth, async (_req, res) => {
  const userId = res.locals.userId as string;

  const groups = await prisma.group.findMany({
    where: {
      OR: [{ ownerUserId: userId }, { members: { some: { userId } } }],
    },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      currency: true,
      createdAt: true,
      members: {
        select: {
          id: true,
          userId: true,
          displayName: true,
          weight: true,
          role: true,
        },
        orderBy: { id: 'asc' },
      },
      expenses: {
        select: {
          id: true,
          payerMemberId: true,
          amount: true,
          description: true,
          occurredAt: true,
          splitMethod: true,
          splits: {
            select: {
              id: true,
              memberId: true,
              shareAmount: true,
              shareWeight: true,
            },
          },
        },
        orderBy: { occurredAt: 'desc' },
      },
    },
  });

  return res.json({ groups: groups.map(serializeGroupSummary) });
});

groupsRouter.post('/groups', requireAuth, async (req, res) => {
  const userId = res.locals.userId as string;

  const parsed = createGroupSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Datos inválidos', details: parsed.error.format() });
  }

  const owner = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true, currency: true },
  });

  if (!owner) {
    return res.status(401).json({ message: 'No autenticado' });
  }

  const preparedMembers: Array<{ userId: string | null; displayName: string; weight: number | null; role: 'member' | 'admin' }> = [];

  for (const member of parsed.data.members || []) {
    const resolved = await resolveMemberDisplayName(member);
    if (resolved.error) {
      return res.status(resolved.error.status).json(resolved.error.body);
    }

    if (member.userId && preparedMembers.some(item => item.userId === member.userId)) {
      return res.status(400).json({ message: 'No puedes repetir el mismo usuario dentro del grupo' });
    }

    preparedMembers.push({
      userId: member.userId || null,
      displayName: resolved.displayName,
      weight: normalizeWeight(member.weight),
      role: member.role || 'member',
    });
  }

  const group = await prisma.group.create({
    data: {
      name: parsed.data.name.trim(),
      currency: parsed.data.currency?.trim() || owner.currency,
      ownerUserId: userId,
      members: {
        create: [
          {
            userId,
            displayName: owner.name?.trim() || owner.email,
            weight: 1,
            role: 'admin',
          },
          ...preparedMembers,
        ],
      },
    },
    select: {
      id: true,
      name: true,
      currency: true,
      createdAt: true,
      members: {
        select: {
          id: true,
          userId: true,
          displayName: true,
          weight: true,
          role: true,
        },
        orderBy: { id: 'asc' },
      },
      expenses: {
        select: {
          id: true,
          payerMemberId: true,
          amount: true,
          description: true,
          occurredAt: true,
          splitMethod: true,
          splits: {
            select: {
              id: true,
              memberId: true,
              shareAmount: true,
              shareWeight: true,
            },
          },
        },
      },
    },
  });

  return res.status(201).json({ group: serializeGroupSummary(group) });
});

groupsRouter.get('/groups/:id/members', requireAuth, async (req, res) => {
  const userId = res.locals.userId as string;
  const access = await assertAccessibleGroup(req.params.id, userId);

  if (access.error) {
    return res.status(access.error.status).json(access.error.body);
  }

  return res.json({
    members: access.group.members.map(serializeGroupMember),
  });
});

groupsRouter.post('/groups/:id/members', requireAuth, async (req, res) => {
  const userId = res.locals.userId as string;
  const access = await assertAdminGroup(req.params.id, userId);

  if (access.error) {
    return res.status(access.error.status).json(access.error.body);
  }

  const parsed = groupMemberInputSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Datos inválidos', details: parsed.error.format() });
  }

  if (parsed.data.userId && access.group.members.some((member: { userId: string | null }) => member.userId === parsed.data.userId)) {
    return res.status(400).json({ message: 'Ese usuario ya pertenece al grupo' });
  }

  const resolved = await resolveMemberDisplayName(parsed.data);
  if (resolved.error) {
    return res.status(resolved.error.status).json(resolved.error.body);
  }

  const member = await prisma.groupMember.create({
    data: {
      groupId: access.group.id,
      userId: parsed.data.userId || null,
      displayName: resolved.displayName,
      weight: normalizeWeight(parsed.data.weight),
      role: parsed.data.role || 'member',
    },
    select: {
      id: true,
      userId: true,
      displayName: true,
      weight: true,
      role: true,
    },
  });

  return res.status(201).json({ member: serializeGroupMember(member) });
});

groupsRouter.put('/groups/:id/members/:mid', requireAuth, async (req, res) => {
  const userId = res.locals.userId as string;
  const access = await assertAdminGroup(req.params.id, userId);

  if (access.error) {
    return res.status(access.error.status).json(access.error.body);
  }

  const parsed = updateMemberSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Datos inválidos', details: parsed.error.format() });
  }

  const member = access.group.members.find((item: { id: string }) => item.id === req.params.mid);
  if (!member) {
    return res.status(404).json({ message: 'Miembro no encontrado' });
  }

  if (member.userId === userId && parsed.data.role === 'member') {
    const adminCount = access.group.members.filter((item: { role: string }) => item.role === 'admin').length;
    if (adminCount <= 1) {
      return res.status(400).json({ message: 'El último admin no puede perder permisos de administración' });
    }
  }

  const updated = await prisma.groupMember.update({
    where: { id: member.id },
    data: {
      displayName: parsed.data.displayName?.trim() || undefined,
      weight: parsed.data.weight === undefined ? undefined : normalizeWeight(parsed.data.weight),
      role: parsed.data.role || undefined,
    },
    select: {
      id: true,
      userId: true,
      displayName: true,
      weight: true,
      role: true,
    },
  });

  return res.json({ member: serializeGroupMember(updated) });
});

groupsRouter.delete('/groups/:id/members/:mid', requireAuth, async (req, res) => {
  const userId = res.locals.userId as string;
  const access = await assertAdminGroup(req.params.id, userId);

  if (access.error) {
    return res.status(access.error.status).json(access.error.body);
  }

  const member = access.group.members.find((item: { id: string }) => item.id === req.params.mid);
  if (!member) {
    return res.status(404).json({ message: 'Miembro no encontrado' });
  }

  if (member.userId === userId) {
    return res.status(400).json({ message: 'No puedes eliminarte a ti mismo del grupo' });
  }

  if (member.role === 'admin') {
    const adminCount = access.group.members.filter((item: { role: string }) => item.role === 'admin').length;
    if (adminCount <= 1) {
      return res.status(400).json({ message: 'No puedes eliminar al último admin del grupo' });
    }
  }

  const references = await prisma.groupMember.findUnique({
    where: { id: member.id },
    select: {
      _count: {
        select: {
          expensesAsPayer: true,
          splits: true,
          settlementsFrom: true,
          settlementsTo: true,
        },
      },
    },
  });

  const referenceCount =
    (references?._count.expensesAsPayer || 0) +
    (references?._count.splits || 0) +
    (references?._count.settlementsFrom || 0) +
    (references?._count.settlementsTo || 0);

  if (referenceCount > 0) {
    return res.status(400).json({ message: 'No puedes eliminar un miembro con gastos, splits o liquidaciones asociadas' });
  }

  await prisma.groupMember.delete({
    where: { id: member.id },
  });

  return res.status(204).send();
});

groupsRouter.get('/groups/:id/expenses', requireAuth, async (req, res) => {
  const userId = res.locals.userId as string;
  const access = await assertAccessibleGroup(req.params.id, userId);

  if (access.error) {
    return res.status(access.error.status).json(access.error.body);
  }

  const expenses = await prisma.groupExpense.findMany({
    where: { groupId: access.group.id },
    orderBy: { occurredAt: 'desc' },
    select: {
      id: true,
      payerMemberId: true,
      amount: true,
      description: true,
      occurredAt: true,
      splitMethod: true,
      splits: {
        select: {
          id: true,
          memberId: true,
          shareAmount: true,
          shareWeight: true,
        },
      },
    },
  });

  return res.json({ expenses: expenses.map(serializeGroupExpense) });
});

groupsRouter.post('/groups/:id/expenses', requireAuth, async (req, res) => {
  const userId = res.locals.userId as string;
  const access = await assertAdminGroup(req.params.id, userId);

  if (access.error) {
    return res.status(access.error.status).json(access.error.body);
  }

  const parsed = expenseSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Datos inválidos', details: parsed.error.format() });
  }

  const amount = normalizeAmount(parsed.data.amount);
  if (!amount) {
    return res.status(400).json({ message: 'Monto inválido' });
  }

  const occurredAt = normalizeOccurredAt(parsed.data.occurredAt);
  if (!occurredAt) {
    return res.status(400).json({ message: 'Fecha inválida' });
  }

  const payerExists = access.group.members.some((member: { id: string }) => member.id === parsed.data.payerMemberId);
  if (!payerExists) {
    return res.status(400).json({ message: 'El pagador no pertenece al grupo' });
  }

  const splits = buildExpenseSplits(amount, parsed.data.splitMethod, access.group.members);

  const expense = await prisma.groupExpense.create({
    data: {
      groupId: access.group.id,
      payerMemberId: parsed.data.payerMemberId,
      amount,
      description: parsed.data.description?.trim() || null,
      occurredAt,
      splitMethod: parsed.data.splitMethod,
      splits: {
        create: splits,
      },
    },
    select: {
      id: true,
      payerMemberId: true,
      amount: true,
      description: true,
      occurredAt: true,
      splitMethod: true,
      splits: {
        select: {
          id: true,
          memberId: true,
          shareAmount: true,
          shareWeight: true,
        },
      },
    },
  });

  return res.status(201).json({ expense: serializeGroupExpense(expense) });
});

groupsRouter.put('/groups/:id/expenses/:eid', requireAuth, async (req, res) => {
  const userId = res.locals.userId as string;
  const access = await assertAdminGroup(req.params.id, userId);

  if (access.error) {
    return res.status(access.error.status).json(access.error.body);
  }

  const parsed = expenseSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Datos inválidos', details: parsed.error.format() });
  }

  const expense = await prisma.groupExpense.findFirst({
    where: {
      id: req.params.eid,
      groupId: access.group.id,
    },
    select: { id: true },
  });

  if (!expense) {
    return res.status(404).json({ message: 'Gasto no encontrado' });
  }

  const amount = normalizeAmount(parsed.data.amount);
  if (!amount) {
    return res.status(400).json({ message: 'Monto inválido' });
  }

  const occurredAt = normalizeOccurredAt(parsed.data.occurredAt);
  if (!occurredAt) {
    return res.status(400).json({ message: 'Fecha inválida' });
  }

  const payerExists = access.group.members.some((member: { id: string }) => member.id === parsed.data.payerMemberId);
  if (!payerExists) {
    return res.status(400).json({ message: 'El pagador no pertenece al grupo' });
  }

  const splits = buildExpenseSplits(amount, parsed.data.splitMethod, access.group.members);

  const updated = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.groupSplit.deleteMany({
      where: { expenseId: expense.id },
    });

    return tx.groupExpense.update({
      where: { id: expense.id },
      data: {
        payerMemberId: parsed.data.payerMemberId,
        amount,
        description: parsed.data.description?.trim() || null,
        occurredAt,
        splitMethod: parsed.data.splitMethod,
        splits: {
          create: splits,
        },
      },
      select: {
        id: true,
        payerMemberId: true,
        amount: true,
        description: true,
        occurredAt: true,
        splitMethod: true,
        splits: {
          select: {
            id: true,
            memberId: true,
            shareAmount: true,
            shareWeight: true,
          },
        },
      },
    });
  });

  return res.json({ expense: serializeGroupExpense(updated) });
});

groupsRouter.delete('/groups/:id/expenses/:eid', requireAuth, async (req, res) => {
  const userId = res.locals.userId as string;
  const access = await assertAdminGroup(req.params.id, userId);

  if (access.error) {
    return res.status(access.error.status).json(access.error.body);
  }

  const expense = await prisma.groupExpense.findFirst({
    where: {
      id: req.params.eid,
      groupId: access.group.id,
    },
    select: { id: true },
  });

  if (!expense) {
    return res.status(404).json({ message: 'Gasto no encontrado' });
  }

  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.groupSplit.deleteMany({
      where: { expenseId: expense.id },
    });

    await tx.groupExpense.delete({
      where: { id: expense.id },
    });
  });

  return res.status(204).send();
});

groupsRouter.get('/groups/:id/balances', requireAuth, async (req, res) => {
  const userId = res.locals.userId as string;
  const access = await assertAccessibleGroup(req.params.id, userId);

  if (access.error) {
    return res.status(access.error.status).json(access.error.body);
  }

  const group = await prisma.group.findUnique({
    where: { id: access.group.id },
    select: {
      id: true,
      name: true,
      currency: true,
      createdAt: true,
      members: {
        select: {
          id: true,
          userId: true,
          displayName: true,
          weight: true,
          role: true,
        },
        orderBy: { id: 'asc' },
      },
      expenses: {
        orderBy: { occurredAt: 'desc' },
        select: {
          id: true,
          payerMemberId: true,
          amount: true,
          description: true,
          occurredAt: true,
          splitMethod: true,
          splits: {
            select: {
              id: true,
              memberId: true,
              shareAmount: true,
              shareWeight: true,
            },
          },
        },
      },
      settlements: {
        orderBy: { occurredAt: 'desc' },
        select: {
          id: true,
          fromMemberId: true,
          toMemberId: true,
          amount: true,
          occurredAt: true,
          status: true,
        },
      },
    },
  });

  if (!group) {
    return res.status(404).json({ message: 'Grupo no encontrado' });
  }

  const balances = calculateGroupBalances({
    members: group.members.map((member: { id: string; displayName: string; weight: { toString(): string } | null }) => ({
      id: member.id,
      displayName: member.displayName,
      weight: member.weight == null ? null : Number(member.weight.toString()),
    })),
    expenses: group.expenses.map((expense: {
      id: string;
      payerMemberId: string;
      amount: { toString(): string };
      splitMethod: string;
      splits: Array<{
        memberId: string;
        shareAmount: { toString(): string } | null;
        shareWeight: { toString(): string } | null;
      }>;
    }) => ({
      id: expense.id,
      payerMemberId: expense.payerMemberId,
      amount: Number(expense.amount.toString()),
      splitMethod: expense.splitMethod as 'equal' | 'weights',
      splits: expense.splits.map((split: {
        memberId: string;
        shareAmount: { toString(): string } | null;
        shareWeight: { toString(): string } | null;
      }) => ({
        memberId: split.memberId,
        shareAmount: split.shareAmount == null ? null : Number(split.shareAmount.toString()),
        shareWeight: split.shareWeight == null ? null : Number(split.shareWeight.toString()),
      })),
    })),
    settlements: group.settlements.map((settlement: {
      fromMemberId: string;
      toMemberId: string;
      amount: { toString(): string };
      status: string;
    }) => ({
      fromMemberId: settlement.fromMemberId,
      toMemberId: settlement.toMemberId,
      amount: Number(settlement.amount.toString()),
      status: settlement.status,
    })),
  });

  const suggestions = calculateSettlementSuggestions(
    balances.map(balance => ({
      memberId: balance.memberId,
      memberName: balance.memberName,
      netCents: balance.netCents,
    }))
  );

  return res.json({
    group: {
      id: group.id,
      name: group.name,
      currency: group.currency,
      createdAt: group.createdAt.toISOString(),
    },
    members: group.members.map(serializeGroupMember),
    expenses: group.expenses.map(serializeGroupExpense),
    settlements: group.settlements.map(serializeGroupSettlement),
    balances: balances.map(({ netCents, ...balance }) => balance),
    suggestions,
  });
});

groupsRouter.post('/groups/:id/settlements', requireAuth, async (req, res) => {
  const userId = res.locals.userId as string;
  const access = await assertAdminGroup(req.params.id, userId);

  if (access.error) {
    return res.status(access.error.status).json(access.error.body);
  }

  const parsed = settlementSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Datos inválidos', details: parsed.error.format() });
  }

  if (parsed.data.fromMemberId === parsed.data.toMemberId) {
    return res.status(400).json({ message: 'La liquidación debe ser entre miembros diferentes' });
  }

  const amount = normalizeAmount(parsed.data.amount);
  if (!amount) {
    return res.status(400).json({ message: 'Monto inválido' });
  }

  const occurredAt = normalizeOccurredAt(parsed.data.occurredAt);
  if (!occurredAt) {
    return res.status(400).json({ message: 'Fecha inválida' });
  }

  const memberIds = new Set(access.group.members.map((member: { id: string }) => member.id));
  if (!memberIds.has(parsed.data.fromMemberId) || !memberIds.has(parsed.data.toMemberId)) {
    return res.status(400).json({ message: 'Los miembros indicados no pertenecen al grupo' });
  }

  const settlement = await prisma.groupSettlement.create({
    data: {
      groupId: access.group.id,
      fromMemberId: parsed.data.fromMemberId,
      toMemberId: parsed.data.toMemberId,
      amount,
      occurredAt,
      status: 'proposed',
    },
    select: {
      id: true,
      fromMemberId: true,
      toMemberId: true,
      amount: true,
      occurredAt: true,
      status: true,
    },
  });

  return res.status(201).json({ settlement: serializeGroupSettlement(settlement) });
});

groupsRouter.put('/groups/:id/settlements/:sid', requireAuth, async (req, res) => {
  const userId = res.locals.userId as string;
  const access = await assertAdminGroup(req.params.id, userId);

  if (access.error) {
    return res.status(access.error.status).json(access.error.body);
  }

  const parsed = updateSettlementSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Datos inválidos', details: parsed.error.format() });
  }

  const settlement = await prisma.groupSettlement.findFirst({
    where: {
      id: req.params.sid,
      groupId: access.group.id,
    },
    select: {
      id: true,
      fromMemberId: true,
      toMemberId: true,
      amount: true,
      occurredAt: true,
      status: true,
    },
  });

  if (!settlement) {
    return res.status(404).json({ message: 'Liquidación no encontrada' });
  }

  const updated = await prisma.groupSettlement.update({
    where: { id: settlement.id },
    data: {
      status: parsed.data.status,
    },
    select: {
      id: true,
      fromMemberId: true,
      toMemberId: true,
      amount: true,
      occurredAt: true,
      status: true,
    },
  });

  return res.json({ settlement: serializeGroupSettlement(updated) });
});
