import type { Prisma } from '@prisma/client';
import { randomInt } from 'crypto';
import { Router } from 'express';
import { z } from 'zod';
import { calculateGroupBalances, calculateSettlementSuggestions, fromCents, roundMoney, toCents } from '../lib/groupBalances.js';
import { syncGroupExpenseLedger, syncGroupSettlementLedger } from '../lib/personalLedgerSync.js';
import {
  serializeGroupExpense,
  serializeGroupMember,
  serializeGroupSettlement,
  serializeGroupSummary,
} from '../lib/groupSerializers.js';
import { prisma } from '../db/prisma.js';
import { requireAuth } from '../middlewares/requireAuth.js';
import { sendPushToUser } from '../lib/push.js';
import { sendError, zodIssuesDetails, type ApiErrorBody } from '../lib/apiError.js';
import {
  checkIdempotency,
  saveIdempotencyRecord,
  handleIdempotencyConflict,
  returnExistingIdempotentResponse,
  hashPayload,
} from '../lib/idempotency.js';

export const groupsRouter = Router();

const DEFAULT_CURRENCY = 'EUR';
const JOIN_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const JOIN_CODE_LENGTH = 8;
const positiveAmountSchema = z.union([z.number().positive(), z.string().min(1)]);
const nonNegativeAmountSchema = z.union([z.number().min(0), z.string().min(0)]);

const numberFromUnknown = (value: unknown) => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return Number(value);
  return Number.NaN;
};

const normalizeAmount = (value: unknown) => {
  const amount = numberFromUnknown(value);
  return Number.isFinite(amount) && amount > 0 ? roundMoney(amount) : null;
};

const normalizeShareAmount = (value: unknown) => {
  const amount = numberFromUnknown(value);
  return Number.isFinite(amount) && amount >= 0 ? roundMoney(amount) : null;
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

const manualSplitSchema = z.object({
  memberId: z.string().uuid(),
  shareAmount: nonNegativeAmountSchema,
});

const expenseSchema = z
  .object({
    payerMemberId: z.string().uuid(),
    amount: positiveAmountSchema,
    description: z.string().trim().optional(),
    categoryId: z.string().uuid().optional().nullable(),
    occurredAt: z.string().datetime().optional(),
    splitMethod: z.enum(['equal', 'manual']),
    splits: z.array(manualSplitSchema).optional(),
    idempotencyKey: z.string().trim().min(1).max(128),
  })
  .superRefine((value, ctx) => {
    if (value.splitMethod === 'manual' && (!value.splits || value.splits.length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Debes indicar splits para el reparto personalizado',
        path: ['splits'],
      });
    }
  });

const settlementSchema = z.object({
  fromMemberId: z.string().uuid(),
  toMemberId: z.string().uuid(),
  amount: positiveAmountSchema,
  occurredAt: z.string().datetime().optional(),
  idempotencyKey: z.string().trim().min(1).max(128),
});

const updateSettlementSchema = z.object({
  status: z.enum(['confirmed', 'cancelled']),
});

const joinByCodeSchema = z.object({
  code: z.string().trim().min(4).max(32),
});

type RouteError = {
  status: number;
  body: ApiErrorBody;
};

const generateJoinCodeValue = () =>
  Array.from({ length: JOIN_CODE_LENGTH }, () => JOIN_CODE_ALPHABET[randomInt(JOIN_CODE_ALPHABET.length)]).join('');

const createUniqueJoinCode = async () => {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const joinCode = generateJoinCodeValue();
    const existingGroup = await prisma.group.findUnique({
      where: { joinCode },
      select: { id: true },
    });

    if (!existingGroup) {
      return joinCode;
    }
  }

  throw new Error('No se pudo generar un código de grupo único');
};

const getAccessibleGroup = async (groupId: string, userId: string) => {
  return prisma.group.findFirst({
    where: {
      id: groupId,
      OR: [{ ownerUserId: userId }, { members: { some: { userId, leftAt: null } } }],
    },
    select: {
      id: true,
      ownerUserId: true,
      currency: true,
      members: {
        where: { leftAt: null },
        select: {
          id: true,
          userId: true,
          displayName: true,
          weight: true,
          role: true,
          leftAt: true,
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
              leftAt: null,
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
        where: { leftAt: null },
        select: {
          id: true,
          userId: true,
          displayName: true,
          weight: true,
          role: true,
          leftAt: true,
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
      error: { status: 404, body: { error: { code: 'GROUP_NOT_FOUND', message: 'Grupo no encontrado' } } } as RouteError,
    } as { error: RouteError; group?: never };
  }

  return { group } as { group: AccessibleGroup; error?: never };
};

const assertAdminGroup = async (groupId: string, userId: string) => {
  const group = await getAdminGroup(groupId, userId);
  if (!group) {
    return {
      error: { status: 403, body: { error: { code: 'GROUP_ADMIN_REQUIRED', message: 'No autorizado para administrar este grupo' } } } as RouteError,
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
        error: { status: 400, body: { error: { code: 'GROUP_MEMBER_USER_NOT_FOUND', message: 'El usuario indicado no existe' } } } as RouteError,
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

type ExpenseSplitDraft = {
  memberId: string;
  shareAmount: number;
  shareWeight: number | null;
};

type ExpenseSplitBuildResult =
  | { splits: ExpenseSplitDraft[]; error?: never }
  | { error: string; splits?: never };

const buildExpenseSplits = (
  amount: number,
  splitMethod: 'equal' | 'manual',
  members: Array<{ id: string; weight: { toString(): string } | null }>,
  manualSplits?: Array<z.infer<typeof manualSplitSchema>>
): ExpenseSplitBuildResult => {
  const memberIds = [...members].sort((a, b) => a.id.localeCompare(b.id));
  const amountCents = toCents(amount);

  if (splitMethod === 'equal') {
    const baseShare = Math.floor(amountCents / (memberIds.length || 1));
    let remainder = amountCents - baseShare * memberIds.length;

    return {
      splits: memberIds.map(member => {
        const shareCents = baseShare + (remainder > 0 ? 1 : 0);
        remainder = Math.max(0, remainder - 1);

        return {
          memberId: member.id,
          shareAmount: fromCents(shareCents),
          shareWeight: null,
        };
      }),
    };
  }

  if (!manualSplits || manualSplits.length !== memberIds.length) {
    return { error: 'Debes indicar un importe para cada miembro del grupo' };
  }

  const validMemberIds = new Set(memberIds.map(member => member.id));
  const seenMemberIds = new Set<string>();
  const splitAmounts = new Map<string, number>();
  let assignedCents = 0;

  for (const split of manualSplits) {
    if (!validMemberIds.has(split.memberId)) {
      return { error: 'Todos los importes deben corresponder a miembros reales del grupo' };
    }

    if (seenMemberIds.has(split.memberId)) {
      return { error: 'No puedes repetir miembros en el reparto personalizado' };
    }

    const shareAmount = normalizeShareAmount(split.shareAmount);
    if (shareAmount === null) {
      return { error: 'Cada importe del reparto personalizado debe ser un valor válido' };
    }

    seenMemberIds.add(split.memberId);
    splitAmounts.set(split.memberId, shareAmount);
    assignedCents += toCents(shareAmount);
  }

  if (seenMemberIds.size !== memberIds.length) {
    return { error: 'Debes indicar el reparto para todos los miembros del grupo' };
  }

  if (assignedCents === 0) {
    return { error: 'Al menos un miembro debe participar con un importe mayor que 0' };
  }

  if (assignedCents !== amountCents) {
    return { error: 'La suma del reparto personalizado debe coincidir exactamente con el gasto total' };
  }

  return {
    splits: memberIds.map(member => ({
      memberId: member.id,
      shareAmount: splitAmounts.get(member.id) || 0,
      shareWeight: null,
    })),
  };
};

groupsRouter.get('/groups', requireAuth, async (_req, res) => {
  const userId = res.locals.userId as string;

  const groups = await prisma.group.findMany({
    where: {
      OR: [{ ownerUserId: userId }, { members: { some: { userId, leftAt: null } } }],
    },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      currency: true,
      createdAt: true,
      members: {
        where: { leftAt: null },
        select: {
          id: true,
          userId: true,
          displayName: true,
          weight: true,
          role: true,
          leftAt: true,
        },
        orderBy: { id: 'asc' },
      },
      expenses: {
        select: {
          id: true,
          payerMemberId: true,
          createdByMemberId: true,
          amount: true,
          description: true,
          categoryId: true,
          category: {
            select: {
              id: true,
              name: true,
              type: true,
              color: true,
              icon: true,
            },
          },
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
    return sendError(res, 400, 'VALIDATION_FAILED', 'Datos inválidos', zodIssuesDetails(parsed.error));
  }

  const owner = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true, currency: true },
  });

  if (!owner) {
    return sendError(res, 401, 'AUTH_UNAUTHENTICATED', 'No autenticado');
  }

  const joinCode = await createUniqueJoinCode();

  const preparedMembers: Array<{ userId: string | null; displayName: string; weight: number | null; role: 'member' | 'admin' }> = [];

  for (const member of parsed.data.members || []) {
    const resolved = await resolveMemberDisplayName(member);
    if (resolved.error) {
      return res.status(resolved.error.status).json(resolved.error.body);
    }

    if (member.userId && preparedMembers.some(item => item.userId === member.userId)) {
      return sendError(res, 400, 'GROUP_MEMBER_DUPLICATE', 'No puedes repetir el mismo usuario dentro del grupo');
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
      currency: parsed.data.currency?.trim() || DEFAULT_CURRENCY,
      joinCode,
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
          leftAt: true,
        },
        orderBy: { id: 'asc' },
      },
      expenses: {
        select: {
          id: true,
          payerMemberId: true,
          createdByMemberId: true,
          amount: true,
          description: true,
          categoryId: true,
          category: {
            select: {
              id: true,
              name: true,
              type: true,
              color: true,
              icon: true,
            },
          },
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

  return res.status(201).json({ group: serializeGroupSummary(group) });
});

groupsRouter.post('/groups/join-by-code', requireAuth, async (req, res) => {
  const userId = res.locals.userId as string;

  const parsed = joinByCodeSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, 'VALIDATION_FAILED', 'Datos inválidos', zodIssuesDetails(parsed.error));
  }

  const code = parsed.data.code.trim().toUpperCase();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true },
  });

  if (!user) {
    return sendError(res, 401, 'AUTH_UNAUTHENTICATED', 'No autenticado');
  }

  const group = await prisma.group.findUnique({
    where: { joinCode: code },
    select: {
      id: true,
      name: true,
      members: {
        where: { leftAt: null },
        select: {
          id: true,
          userId: true,
          displayName: true,
          weight: true,
          role: true,
          leftAt: true,
        },
        orderBy: { id: 'asc' },
      },
      expenses: {
        select: {
          id: true,
          payerMemberId: true,
          createdByMemberId: true,
          amount: true,
          description: true,
          categoryId: true,
          category: {
            select: {
              id: true,
              name: true,
              type: true,
              color: true,
              icon: true,
            },
          },
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

  if (!group) {
    return sendError(res, 404, 'GROUP_JOIN_CODE_INVALID', 'Código de grupo no válido');
  }

  if (group.members.some((member: { userId: string | null }) => member.userId === userId)) {
    return sendError(res, 400, 'GROUP_ALREADY_MEMBER', 'Ya formas parte de este grupo');
  }

  await prisma.groupMember.create({
    data: {
      groupId: group.id,
      userId,
      displayName: user.name?.trim() || user.email,
      weight: 1,
      role: 'member',
    },
  });

  const refreshedGroup = await prisma.group.findUnique({
    where: { id: group.id },
    select: {
      id: true,
      name: true,
      currency: true,
      createdAt: true,
      members: {
        where: { leftAt: null },
        select: {
          id: true,
          userId: true,
          displayName: true,
          weight: true,
          role: true,
          leftAt: true,
        },
        orderBy: { id: 'asc' },
      },
      expenses: {
        select: {
          id: true,
          payerMemberId: true,
          createdByMemberId: true,
          amount: true,
          description: true,
          categoryId: true,
          category: {
            select: {
              id: true,
              name: true,
              type: true,
              color: true,
              icon: true,
            },
          },
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

  if (!refreshedGroup) {
    return sendError(res, 404, 'GROUP_NOT_FOUND', 'Grupo no encontrado');
  }

  return res.status(201).json({
    group: serializeGroupSummary(refreshedGroup),
    message: `Te has unido al grupo ${refreshedGroup.name}`,
  });
});

groupsRouter.get('/groups/:id/join-code', requireAuth, async (req, res) => {
  const userId = res.locals.userId as string;
  const access = await assertAdminGroup(req.params.id, userId);

  if (access.error) {
    return res.status(access.error.status).json(access.error.body);
  }

  const group = await prisma.group.findUnique({
    where: { id: access.group.id },
    select: {
      id: true,
      name: true,
      joinCode: true,
    },
  });

  if (!group) {
    return sendError(res, 404, 'GROUP_NOT_FOUND', 'Grupo no encontrado');
  }

  let joinCode = group.joinCode;

  if (!joinCode) {
    const updatedGroup = await prisma.group.update({
      where: { id: group.id },
      data: {
        joinCode: await createUniqueJoinCode(),
      },
      select: { joinCode: true },
    });

    joinCode = updatedGroup.joinCode;
  }

  return res.json({
    groupId: group.id,
    groupName: group.name,
    joinCode,
  });
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
    return sendError(res, 400, 'VALIDATION_FAILED', 'Datos inválidos', zodIssuesDetails(parsed.error));
  }

  if (parsed.data.userId && access.group.members.some((member: { userId: string | null }) => member.userId === parsed.data.userId)) {
    return sendError(res, 400, 'GROUP_MEMBER_ALREADY_EXISTS', 'Ese usuario ya pertenece al grupo');
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
    return sendError(res, 400, 'VALIDATION_FAILED', 'Datos inválidos', zodIssuesDetails(parsed.error));
  }

  const member = access.group.members.find((item: { id: string }) => item.id === req.params.mid);
  if (!member) {
    return sendError(res, 404, 'GROUP_MEMBER_NOT_FOUND', 'Miembro no encontrado');
  }

  if (member.userId === userId && parsed.data.role === 'member') {
    const adminCount = access.group.members.filter((item: { role: string }) => item.role === 'admin').length;
    if (adminCount <= 1) {
      return sendError(res, 400, 'GROUP_LAST_ADMIN_CANNOT_DEMOTE', 'El último admin no puede perder permisos de administración');
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
    return sendError(res, 404, 'GROUP_MEMBER_NOT_FOUND', 'Miembro no encontrado');
  }

  if (member.leftAt) {
    return sendError(res, 400, 'GROUP_MEMBER_ALREADY_LEFT', 'Este miembro ya fue dado de baja');
  }

  if (member.userId === userId) {
    return sendError(res, 400, 'GROUP_CANNOT_REMOVE_SELF', 'No puedes eliminarte a ti mismo del grupo');
  }

  if (member.role === 'admin') {
    const adminCount = access.group.members.filter((item: { role: string; leftAt?: Date | null }) => item.role === 'admin' && !item.leftAt).length;
    if (adminCount <= 1) {
      return sendError(res, 400, 'GROUP_LAST_ADMIN_CANNOT_REMOVE', 'No puedes eliminar al último admin del grupo');
    }
  }

  await prisma.groupMember.update({
    where: { id: member.id },
    data: { leftAt: new Date() },
  });

  if (member.userId) {
    const groupInfo = await prisma.group.findUnique({
      where: { id: access.group.id },
      select: { name: true },
    });
    await sendPushToUser(member.userId, {
      title: 'Eliminado de un grupo',
      body: `Has sido eliminado del grupo ${groupInfo?.name || 'un grupo'}`,
      data: { groupId: access.group.id, type: 'member_removed' },
    }).catch(() => {});
  }

  return res.status(204).send();
});

groupsRouter.post('/groups/:id/members/:mid/rejoin', requireAuth, async (req, res) => {
  const userId = res.locals.userId as string;
  const access = await assertAdminGroup(req.params.id, userId);

  if (access.error) {
    return res.status(access.error.status).json(access.error.body);
  }

  const member = access.group.members.find((item: { id: string }) => item.id === req.params.mid);
  if (member) {
    return sendError(res, 400, 'GROUP_MEMBER_ALREADY_ACTIVE', 'Este miembro ya está activo en el grupo');
  }

  const allMembers = await prisma.groupMember.findMany({
    where: { groupId: access.group.id, id: req.params.mid },
    select: { id: true, leftAt: true, role: true },
  });

  const targetMember = allMembers[0];
  if (!targetMember) {
    return sendError(res, 404, 'GROUP_MEMBER_NOT_FOUND', 'Miembro no encontrado');
  }

  if (!targetMember.leftAt) {
    return sendError(res, 400, 'GROUP_MEMBER_ALREADY_ACTIVE', 'Este miembro ya está activo');
  }

  const reactivated = await prisma.groupMember.update({
    where: { id: targetMember.id },
    data: { leftAt: null },
    select: {
      id: true,
      userId: true,
      displayName: true,
      weight: true,
      role: true,
      leftAt: true,
    },
  });

  return res.json({ member: serializeGroupMember(reactivated) });
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
      createdByMemberId: true,
      amount: true,
      description: true,
      categoryId: true,
      category: {
        select: {
          id: true,
          name: true,
          type: true,
          color: true,
          icon: true,
        },
      },
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
  const access = await assertAccessibleGroup(req.params.id, userId);

  if (access.error) {
    return res.status(access.error.status).json(access.error.body);
  }

  const requesterMember = access.group.members.find((member: { userId: string | null }) => member.userId === userId);
  if (!requesterMember) {
    return sendError(res, 403, 'GROUP_EXPENSE_FORBIDDEN', 'No autorizado para añadir gastos en este grupo');
  }

  const parsed = expenseSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, 'VALIDATION_FAILED', 'Datos inválidos', zodIssuesDetails(parsed.error));
  }

  const amount = normalizeAmount(parsed.data.amount);
  if (!amount) {
    return sendError(res, 400, 'GROUP_EXPENSE_INVALID_AMOUNT', 'Monto inválido');
  }

  const occurredAt = normalizeOccurredAt(parsed.data.occurredAt);
  if (!occurredAt) {
    return sendError(res, 400, 'GROUP_EXPENSE_INVALID_DATE', 'Fecha inválida');
  }

  const payerExists = access.group.members.some((member: { id: string }) => member.id === parsed.data.payerMemberId);
  if (!payerExists) {
    return sendError(res, 400, 'GROUP_EXPENSE_PAYER_NOT_IN_GROUP', 'El pagador no pertenece al grupo');
  }

  const splitResult = buildExpenseSplits(amount, parsed.data.splitMethod, access.group.members, parsed.data.splits);
  if (splitResult.error) {
    return sendError(res, 400, 'GROUP_EXPENSE_SPLIT_INVALID', splitResult.error);
  }

  if (parsed.data.categoryId) {
    const category = await prisma.category.findFirst({
      where: {
        id: parsed.data.categoryId,
        OR: [
          { userId: null, groupId: null },
          { groupId: access.group.id },
        ],
      },
    });

    if (!category) {
      return sendError(res, 400, 'GROUP_EXPENSE_CATEGORY_NOT_IN_GROUP', 'Categoría no encontrada o no pertenece al grupo');
    }
  }

  const canonicalPayload = {
    groupId: access.group.id,
    payerMemberId: parsed.data.payerMemberId,
    amount,
    description: parsed.data.description?.trim() || null,
    categoryId: parsed.data.categoryId || null,
    occurredAt: occurredAt.toISOString(),
    splitMethod: parsed.data.splitMethod,
    splits: splitResult.splits!.map((s: { memberId: string; shareAmount: number; shareWeight: number | null }) => ({
      memberId: s.memberId,
      shareAmount: s.shareAmount,
      shareWeight: s.shareWeight,
    })).sort((a: { memberId: string }, b: { memberId: string }) => a.memberId.localeCompare(b.memberId)),
  };
  const requestHash = hashPayload(canonicalPayload);
  const endpoint = 'groups.expenses.create';

  const idempotencyCheck = await checkIdempotency(userId, endpoint, parsed.data.idempotencyKey, requestHash);

  if (idempotencyCheck.action === 'return-existing') {
    return returnExistingIdempotentResponse(res, idempotencyCheck.existing);
  }

  if (idempotencyCheck.action === 'conflict') {
    return handleIdempotencyConflict(res);
  }

  const expense = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const created = await tx.groupExpense.create({
      data: {
        groupId: access.group.id,
        createdByMemberId: requesterMember.id,
        payerMemberId: parsed.data.payerMemberId,
        amount,
        description: parsed.data.description?.trim() || null,
        categoryId: parsed.data.categoryId || null,
        occurredAt,
        splitMethod: parsed.data.splitMethod,
        splits: {
          create: splitResult.splits,
        },
      },
      select: {
        id: true,
        payerMemberId: true,
        createdByMemberId: true,
        amount: true,
        description: true,
        categoryId: true,
        category: {
          select: {
            id: true,
            name: true,
            type: true,
            color: true,
            icon: true,
          },
        },
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

    await syncGroupExpenseLedger(tx, created.id);
    return created;
  });

  const responseBody = { expense: serializeGroupExpense(expense) };
  await saveIdempotencyRecord(userId, endpoint, parsed.data.idempotencyKey, requestHash, 201, responseBody);

  const creatorMemberId = requesterMember.id;
  const allGroupMembers = await prisma.groupMember.findMany({
    where: { groupId: access.group.id },
    select: { id: true, userId: true, displayName: true },
  });

  const groupInfo = await prisma.group.findUnique({
    where: { id: access.group.id },
    select: { name: true },
  });

  const payerMember = allGroupMembers.find((m: { id: string }) => m.id === parsed.data.payerMemberId);
  const payerName = payerMember?.displayName || 'Alguien';

  for (const member of allGroupMembers) {
    if (member.id === creatorMemberId || !member.userId) continue;
    await sendPushToUser(member.userId, {
      title: `Nuevo gasto en ${groupInfo?.name || 'un grupo'}`,
      body: `${payerName} añadió un gasto de ${parsed.data.amount}€`,
      data: { groupId: access.group.id, type: 'expense' },
    }).catch(() => {});
  }

  return res.status(201).json(responseBody);
});

groupsRouter.put('/groups/:id/expenses/:eid', requireAuth, async (req, res) => {
  const userId = res.locals.userId as string;
  const access = await assertAccessibleGroup(req.params.id, userId);

  if (access.error) {
    return res.status(access.error.status).json(access.error.body);
  }

  const parsed = expenseSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, 'VALIDATION_FAILED', 'Datos inválidos', zodIssuesDetails(parsed.error));
  }

  const expense = await prisma.groupExpense.findFirst({
    where: {
      id: req.params.eid,
      groupId: access.group.id,
    },
    select: { id: true, payerMemberId: true, createdByMemberId: true },
  });

  if (!expense) {
    return sendError(res, 404, 'GROUP_EXPENSE_NOT_FOUND', 'Gasto no encontrado');
  }

  const requesterMember = access.group.members.find((member: { userId: string | null }) => member.userId === userId);
  const canEditExpense =
    access.group.ownerUserId === userId ||
    requesterMember?.role === 'admin' ||
    requesterMember?.id === expense.createdByMemberId ||
    (!expense.createdByMemberId && requesterMember?.id === expense.payerMemberId);

  if (!canEditExpense) {
    return sendError(res, 403, 'GROUP_EXPENSE_FORBIDDEN', 'No autorizado para editar este gasto');
  }

  const amount = normalizeAmount(parsed.data.amount);
  if (!amount) {
    return sendError(res, 400, 'GROUP_EXPENSE_INVALID_AMOUNT', 'Monto inválido');
  }

  const occurredAt = normalizeOccurredAt(parsed.data.occurredAt);
  if (!occurredAt) {
    return sendError(res, 400, 'GROUP_EXPENSE_INVALID_DATE', 'Fecha inválida');
  }

  const payerExists = access.group.members.some((member: { id: string }) => member.id === parsed.data.payerMemberId);
  if (!payerExists) {
    return sendError(res, 400, 'GROUP_EXPENSE_PAYER_NOT_IN_GROUP', 'El pagador no pertenece al grupo');
  }

  const splitResult = buildExpenseSplits(amount, parsed.data.splitMethod, access.group.members, parsed.data.splits);
  if (splitResult.error) {
    return sendError(res, 400, 'GROUP_EXPENSE_SPLIT_INVALID', splitResult.error);
  }

  if (parsed.data.categoryId) {
    const category = await prisma.category.findFirst({
      where: {
        id: parsed.data.categoryId,
        OR: [
          { userId: null, groupId: null },
          { groupId: access.group.id },
        ],
      },
    });

    if (!category) {
      return sendError(res, 400, 'GROUP_EXPENSE_CATEGORY_NOT_IN_GROUP', 'Categoría no encontrada o no pertenece al grupo');
    }
  }

  const updated = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.groupSplit.deleteMany({
      where: { expenseId: expense.id },
    });

    const nextExpense = await tx.groupExpense.update({
      where: { id: expense.id },
      data: {
        payerMemberId: parsed.data.payerMemberId,
        amount,
        description: parsed.data.description?.trim() || null,
        categoryId: parsed.data.categoryId || null,
        occurredAt,
        splitMethod: parsed.data.splitMethod,
        splits: {
          create: splitResult.splits,
        },
      },
      select: {
        id: true,
        payerMemberId: true,
        amount: true,
        description: true,
        categoryId: true,
        category: {
          select: {
            id: true,
            name: true,
            type: true,
            color: true,
            icon: true,
          },
        },
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

    await syncGroupExpenseLedger(tx, nextExpense.id);
    return nextExpense;
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
    return sendError(res, 404, 'GROUP_EXPENSE_NOT_FOUND', 'Gasto no encontrado');
  }

  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.personalTransaction.deleteMany({
      where: {
        sourceType: 'group_expense',
        sourceRefId: expense.id,
      },
    });

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
        where: { leftAt: null },
        select: {
          id: true,
          userId: true,
          displayName: true,
          weight: true,
          role: true,
          leftAt: true,
        },
        orderBy: { id: 'asc' },
      },
      expenses: {
        orderBy: { occurredAt: 'desc' },
        select: {
          id: true,
          payerMemberId: true,
          createdByMemberId: true,
          amount: true,
          description: true,
          categoryId: true,
          category: {
            select: {
              id: true,
              name: true,
              type: true,
              color: true,
              icon: true,
            },
          },
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
    return sendError(res, 404, 'GROUP_NOT_FOUND', 'Grupo no encontrado');
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
      splitMethod: expense.splitMethod as 'equal' | 'manual' | 'weights',
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
  const access = await assertAccessibleGroup(req.params.id, userId);

  if (access.error) {
    return res.status(access.error.status).json(access.error.body);
  }

  const parsed = settlementSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, 'VALIDATION_FAILED', 'Datos inválidos', zodIssuesDetails(parsed.error));
  }

  if (parsed.data.fromMemberId === parsed.data.toMemberId) {
    return sendError(res, 400, 'GROUP_SETTLEMENT_INVALID_SAME_MEMBER', 'La liquidación debe ser entre miembros diferentes');
  }

  const amount = normalizeAmount(parsed.data.amount);
  if (!amount) {
    return sendError(res, 400, 'GROUP_SETTLEMENT_INVALID_AMOUNT', 'Monto inválido');
  }

  const occurredAt = normalizeOccurredAt(parsed.data.occurredAt);
  if (!occurredAt) {
    return sendError(res, 400, 'GROUP_SETTLEMENT_INVALID_DATE', 'Fecha inválida');
  }

  const memberIds = new Set(access.group.members.map((member: { id: string }) => member.id));
  if (!memberIds.has(parsed.data.fromMemberId) || !memberIds.has(parsed.data.toMemberId)) {
    return sendError(res, 400, 'GROUP_SETTLEMENT_MEMBERS_NOT_IN_GROUP', 'Los miembros indicados no pertenecen al grupo');
  }

  const requesterMember = access.group.members.find((member: { userId: string | null }) => member.userId === userId);
  if (!requesterMember) {
    return sendError(res, 403, 'GROUP_SETTLEMENT_FORBIDDEN_MEMBER_REQUIRED', 'Debes pertenecer al grupo como miembro real para registrar una liquidación');
  }

  if (requesterMember.id !== parsed.data.fromMemberId) {
    return sendError(res, 403, 'GROUP_SETTLEMENT_FORBIDDEN_ONLY_OWN_BALANCE', 'Solo puedes registrar liquidaciones saliendo de tu propio balance');
  }

  const financialGroup = await prisma.group.findUnique({
    where: { id: access.group.id },
    select: {
      members: {
        select: {
          id: true,
          displayName: true,
          weight: true,
          leftAt: true,
        },
        orderBy: { id: 'asc' },
      },
      expenses: {
        select: {
          id: true,
          payerMemberId: true,
          amount: true,
          splitMethod: true,
          splits: {
            select: {
              memberId: true,
              shareAmount: true,
              shareWeight: true,
            },
          },
        },
      },
      settlements: {
        select: {
          fromMemberId: true,
          toMemberId: true,
          amount: true,
          status: true,
        },
      },
    },
  });

  if (!financialGroup) {
    return sendError(res, 404, 'GROUP_NOT_FOUND', 'Grupo no encontrado');
  }

  const balances = calculateGroupBalances({
    members: financialGroup.members.map((member: { id: string; displayName: string; weight: { toString(): string } | null }) => ({
      id: member.id,
      displayName: member.displayName,
      weight: member.weight == null ? null : Number(member.weight.toString()),
    })),
    expenses: financialGroup.expenses.map((expense: {
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
      splitMethod: expense.splitMethod as 'equal' | 'manual' | 'weights',
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
    settlements: financialGroup.settlements.map((settlement: {
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

  const fromBalance = balances.find(balance => balance.memberId === parsed.data.fromMemberId);
  const toBalance = balances.find(balance => balance.memberId === parsed.data.toMemberId);

  if (!fromBalance || fromBalance.netCents >= 0) {
    return sendError(res, 400, 'GROUP_SETTLEMENT_INVALID_NO_DEBT', 'Ese miembro no tiene deuda pendiente que liquidar');
  }

  if (!toBalance || toBalance.netCents <= 0) {
    return sendError(res, 400, 'GROUP_SETTLEMENT_INVALID_DIRECTION', 'Solo puedes liquidar hacia un miembro con saldo a favor');
  }

  const maxAmount = fromCents(Math.min(Math.abs(fromBalance.netCents), toBalance.netCents));
  if (amount > maxAmount) {
    return sendError(res, 400, 'GROUP_SETTLEMENT_INVALID_AMOUNT', `El monto supera lo pendiente entre ambos miembros. Máximo liquidable: ${maxAmount.toFixed(2)}`);
  }

  const canonicalPayload = {
    groupId: access.group.id,
    fromMemberId: parsed.data.fromMemberId,
    toMemberId: parsed.data.toMemberId,
    amount,
    occurredAt: occurredAt.toISOString(),
  };
  const requestHash = hashPayload(canonicalPayload);
  const endpoint = 'groups.settlements.create';

  const idempotencyCheck = await checkIdempotency(userId, endpoint, parsed.data.idempotencyKey, requestHash);

  if (idempotencyCheck.action === 'return-existing') {
    return returnExistingIdempotentResponse(res, idempotencyCheck.existing);
  }

  if (idempotencyCheck.action === 'conflict') {
    return handleIdempotencyConflict(res);
  }

  const settlement = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const created = await tx.groupSettlement.create({
      data: {
        groupId: access.group.id,
        fromMemberId: parsed.data.fromMemberId,
        toMemberId: parsed.data.toMemberId,
        amount,
        occurredAt,
        status: 'confirmed',
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

    await syncGroupSettlementLedger(tx, created.id);
    return created;
  });

  const responseBody = { settlement: serializeGroupSettlement(settlement) };
  await saveIdempotencyRecord(userId, endpoint, parsed.data.idempotencyKey, requestHash, 201, responseBody);

  const toMember = await prisma.groupMember.findUnique({
    where: { id: parsed.data.toMemberId },
    select: { userId: true, displayName: true },
  });
  const fromMember = await prisma.groupMember.findUnique({
    where: { id: parsed.data.fromMemberId },
    select: { displayName: true },
  });
  const groupInfo = await prisma.group.findUnique({
    where: { id: access.group.id },
    select: { name: true },
  });

  if (toMember?.userId) {
    await sendPushToUser(toMember.userId, {
      title: `Liquidación en ${groupInfo?.name || 'un grupo'}`,
      body: `${fromMember?.displayName || 'Alguien'} te ha liquidado ${amount}€`,
      data: { groupId: access.group.id, type: 'settlement' },
    }).catch(() => {});
  }

  return res.status(201).json(responseBody);
});

groupsRouter.put('/groups/:id/settlements/:sid', requireAuth, async (req, res) => {
  const userId = res.locals.userId as string;
  const access = await assertAdminGroup(req.params.id, userId);

  if (access.error) {
    return res.status(access.error.status).json(access.error.body);
  }

  const parsed = updateSettlementSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, 'VALIDATION_FAILED', 'Datos inválidos', zodIssuesDetails(parsed.error));
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
    return sendError(res, 404, 'GROUP_SETTLEMENT_NOT_FOUND', 'Liquidación no encontrada');
  }

  const updated = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const nextSettlement = await tx.groupSettlement.update({
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

    await syncGroupSettlementLedger(tx, nextSettlement.id);
    return nextSettlement;
  });

  return res.json({ settlement: serializeGroupSettlement(updated) });
});
