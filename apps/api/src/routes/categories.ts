import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { requireAuth } from '../middlewares/requireAuth.js';
import { sendError, zodIssuesDetails } from '../lib/apiError.js';

export const categoriesRouter = Router();

const createCategorySchema = z.object({
  name: z.string().trim().min(1),
  type: z.enum(['income', 'expense']),
  color: z.string().trim().optional(),
  icon: z.string().trim().optional(),
});

categoriesRouter.get('/categories', requireAuth, async (_req, res) => {
  const userId = res.locals.userId as string;

  const globalCategories = await prisma.category.findMany({
    where: {
      userId: null,
      groupId: null,
    },
    orderBy: [{ type: 'asc' }, { name: 'asc' }],
    select: {
        id: true,
        name: true,
        type: true,
        color: true,
        icon: true,
        userId: true,
        groupId: true,
      },
    });

  const personalCategories = await prisma.category.findMany({
    where: {
      userId: userId,
      groupId: null,
    },
    orderBy: [{ type: 'asc' }, { name: 'asc' }],
    select: {
        id: true,
        name: true,
        type: true,
        color: true,
        icon: true,
        userId: true,
        groupId: true,
      },
    });

    return res.json({
      categories: [...globalCategories, ...personalCategories].map((cat: any) => ({
        ...cat,
        color: cat.color || '',
        icon: cat.icon || '',
      })),
    });
});

categoriesRouter.post('/categories', requireAuth, async (req, res) => {
  const userId = res.locals.userId as string;

  const parsed = createCategorySchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, 'VALIDATION_FAILED', 'Datos inválidos', zodIssuesDetails(parsed.error));
  }

  try {
    const category = await prisma.category.create({
      data: {
        name: parsed.data.name,
        type: parsed.data.type,
        color: parsed.data.color || null,
        icon: parsed.data.icon || null,
        userId: userId,
      },
      select: {
        id: true,
        name: true,
        type: true,
        color: true,
        icon: true,
        userId: true,
        groupId: true,
      },
    });

    return res.status(201).json({
      category: {
        ...category,
        color: category.color || '',
        icon: category.icon || '',
      },
    });
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return sendError(res, 409, 'CATEGORY_ALREADY_EXISTS', 'Ya existe una categoría personal con ese nombre');
    }
    return sendError(res, 500, 'INTERNAL_SERVER_ERROR', 'Error interno del servidor');
  }
});

categoriesRouter.get('/groups/:id/categories', requireAuth, async (req, res) => {
  const userId = res.locals.userId as string;
  const groupId = req.params.id;

  const group = await prisma.group.findFirst({
    where: {
      id: groupId,
      OR: [{ ownerUserId: userId }, { members: { some: { userId, leftAt: null } } }],
    },
  });

  if (!group) {
    return sendError(res, 404, 'GROUP_NOT_FOUND', 'Grupo no encontrado');
  }

  const globalCategories = await prisma.category.findMany({
    where: {
      userId: null,
      groupId: null,
    },
    orderBy: [{ type: 'asc' }, { name: 'asc' }],
    select: {
        id: true,
        name: true,
        type: true,
        color: true,
        icon: true,
        userId: true,
        groupId: true,
      },
    });

  const groupCategories = await prisma.category.findMany({
    where: {
      groupId: groupId,
    },
    orderBy: [{ type: 'asc' }, { name: 'asc' }],
    select: {
        id: true,
        name: true,
        type: true,
        color: true,
        icon: true,
        userId: true,
        groupId: true,
      },
    });

    return res.json({
      categories: [...globalCategories, ...groupCategories].map((cat: any) => ({
        ...cat,
        color: cat.color || '',
        icon: cat.icon || '',
      })),
    });
});

categoriesRouter.patch('/categories/:id', requireAuth, async (req, res) => {
  const userId = res.locals.userId as string;
  const categoryId = req.params.id;

  const updateSchema = z.object({
    name: z.string().trim().min(1).optional(),
    color: z.string().trim().optional(),
    icon: z.string().trim().optional(),
  });

  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, 'VALIDATION_FAILED', 'Datos inválidos', zodIssuesDetails(parsed.error));
  }

  try {
    const category = await prisma.category.findFirst({
      where: {
        id: categoryId,
        userId: userId,
        groupId: null,
      },
    });

    if (!category) {
      return sendError(res, 404, 'CATEGORY_NOT_FOUND_OR_FORBIDDEN', 'Categoría no encontrada o sin permisos');
    }

    if (parsed.data.name && parsed.data.name !== category.name) {
      const existing = await prisma.category.findFirst({
        where: {
          name: parsed.data.name,
          userId: userId,
          groupId: null,
        },
      });

      if (existing) {
        return sendError(res, 409, 'CATEGORY_ALREADY_EXISTS', 'Ya existe una categoría personal con ese nombre');
      }
    }

    const updatedCategory = await prisma.category.update({
      where: { id: categoryId },
      data: {
        name: parsed.data.name ?? category.name,
        color: parsed.data.color ?? category.color,
        icon: parsed.data.icon ?? category.icon,
      },
      select: {
        id: true,
        name: true,
        type: true,
        color: true,
        icon: true,
        userId: true,
        groupId: true,
      },
    });

    return res.json({
      category: {
        ...updatedCategory,
        color: updatedCategory.color || '',
        icon: updatedCategory.icon || '',
      },
    });
  } catch (error) {
    return sendError(res, 500, 'INTERNAL_SERVER_ERROR', 'Error interno del servidor');
  }
});

categoriesRouter.delete('/categories/:id', requireAuth, async (req, res) => {
  const userId = res.locals.userId as string;
  const categoryId = req.params.id;

  try {
    const category = await prisma.category.findFirst({
      where: {
        id: categoryId,
        userId: userId,
        groupId: null,
      },
    });

    if (!category) {
      return sendError(res, 404, 'CATEGORY_NOT_FOUND_OR_FORBIDDEN', 'Categoría no encontrada o sin permisos');
    }

    await prisma.category.delete({
      where: { id: categoryId },
    });

    return res.json({ message: 'Categoría eliminada correctamente' });
  } catch (error) {
    return sendError(res, 500, 'INTERNAL_SERVER_ERROR', 'Error interno del servidor');
  }
});

categoriesRouter.post('/groups/:id/categories', requireAuth, async (req, res) => {
  const userId = res.locals.userId as string;
  const groupId = req.params.id;

  const group = await prisma.group.findFirst({
    where: {
      id: groupId,
      OR: [{ ownerUserId: userId }, { members: { some: { userId, leftAt: null } } }],
    },
  });

  if (!group) {
    return sendError(res, 404, 'GROUP_NOT_FOUND', 'Grupo no encontrado');
  }

  const parsed = createCategorySchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, 'VALIDATION_FAILED', 'Datos inválidos', zodIssuesDetails(parsed.error));
  }

  try {
    const category = await prisma.category.create({
      data: {
        name: parsed.data.name,
        type: parsed.data.type,
        color: parsed.data.color || null,
        icon: parsed.data.icon || null,
        groupId: groupId,
      },
      select: {
        id: true,
        name: true,
        type: true,
        color: true,
        icon: true,
        userId: true,
        groupId: true,
      },
    });

    return res.status(201).json({
      category: {
        ...category,
        color: category.color || '',
        icon: category.icon || '',
      },
    });
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return sendError(res, 409, 'CATEGORY_ALREADY_EXISTS', 'Ya existe una categoría en el grupo con ese nombre');
    }
    return sendError(res, 500, 'INTERNAL_SERVER_ERROR', 'Error interno del servidor');
  }
});

categoriesRouter.patch('/groups/:groupId/categories/:id', requireAuth, async (req, res) => {
  const userId = res.locals.userId as string;
  const groupId = req.params.groupId;
  const categoryId = req.params.id;

  const updateSchema = z.object({
    name: z.string().trim().min(1).optional(),
    color: z.string().trim().optional(),
    icon: z.string().trim().optional(),
  });

  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, 'VALIDATION_FAILED', 'Datos inválidos', zodIssuesDetails(parsed.error));
  }

  try {
    const group = await prisma.group.findFirst({
      where: {
        id: groupId,
        OR: [{ ownerUserId: userId }, { members: { some: { userId, leftAt: null } } }],
      },
    });

    if (!group) {
      return sendError(res, 404, 'GROUP_NOT_FOUND', 'Grupo no encontrado');
    }

    const category = await prisma.category.findFirst({
      where: {
        id: categoryId,
        groupId: groupId,
      },
    });

    if (!category) {
      return sendError(res, 404, 'CATEGORY_NOT_FOUND_OR_FORBIDDEN', 'Categoría no encontrada o sin permisos');
    }

    if (parsed.data.name && parsed.data.name !== category.name) {
      const existing = await prisma.category.findFirst({
        where: {
          name: parsed.data.name,
          groupId: groupId,
        },
      });

      if (existing) {
        return sendError(res, 409, 'CATEGORY_ALREADY_EXISTS', 'Ya existe una categoría en el grupo con ese nombre');
      }
    }

    const updatedCategory = await prisma.category.update({
      where: { id: categoryId },
      data: {
        name: parsed.data.name ?? category.name,
        color: parsed.data.color ?? category.color,
        icon: parsed.data.icon ?? category.icon,
      },
      select: {
        id: true,
        name: true,
        type: true,
        color: true,
        icon: true,
        userId: true,
        groupId: true,
      },
    });

    return res.json({
      category: {
        ...updatedCategory,
        color: updatedCategory.color || '',
        icon: updatedCategory.icon || '',
      },
    });
  } catch (error) {
    return sendError(res, 500, 'INTERNAL_SERVER_ERROR', 'Error interno del servidor');
  }
});

categoriesRouter.delete('/groups/:groupId/categories/:id', requireAuth, async (req, res) => {
  const userId = res.locals.userId as string;
  const groupId = req.params.groupId;
  const categoryId = req.params.id;

  try {
    const group = await prisma.group.findFirst({
      where: {
        id: groupId,
        OR: [{ ownerUserId: userId }, { members: { some: { userId, leftAt: null } } }],
      },
    });

    if (!group) {
      return sendError(res, 404, 'GROUP_NOT_FOUND', 'Grupo no encontrado');
    }

    const category = await prisma.category.findFirst({
      where: {
        id: categoryId,
        groupId: groupId,
      },
    });

    if (!category) {
      return sendError(res, 404, 'CATEGORY_NOT_FOUND_OR_FORBIDDEN', 'Categoría no encontrada o sin permisos');
    }

    await prisma.category.delete({
      where: { id: categoryId },
    });

    return res.json({ message: 'Categoría eliminada correctamente' });
  } catch (error) {
    return sendError(res, 500, 'INTERNAL_SERVER_ERROR', 'Error interno del servidor');
  }
});
