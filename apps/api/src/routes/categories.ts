import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { requireAuth } from '../middlewares/requireAuth.js';

export const categoriesRouter = Router();

const createCategorySchema = z.object({
  name: z.string().trim().min(1),
  type: z.enum(['income', 'expense']),
  color: z.string().trim().optional(),
  icon: z.string().trim().optional(),
});

// GET /categories - Global and Personal categories
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

// POST /categories - Create a personal category
categoriesRouter.post('/categories', requireAuth, async (req, res) => {
  const userId = res.locals.userId as string;

  const parsed = createCategorySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Datos inválidos', details: parsed.error.format() });
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
      return res.status(409).json({ message: 'Ya existe una categoría personal con ese nombre' });
    }
    return res.status(500).json({ message: 'Error creando categoría' });
  }
});

// GET /groups/:id/categories - Global and Group categories
categoriesRouter.get('/groups/:id/categories', requireAuth, async (req, res) => {
  const userId = res.locals.userId as string;
  const groupId = req.params.id;

  // Validate group access
  const group = await prisma.group.findFirst({
    where: {
      id: groupId,
      OR: [{ ownerUserId: userId }, { members: { some: { userId } } }],
    },
  });

  if (!group) {
    return res.status(404).json({ message: 'Grupo no encontrado' });
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

// PATCH /categories/:id - Update a personal category
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
    return res.status(400).json({ message: 'Datos inválidos', details: parsed.error.format() });
  }

  try {
    // Find the category and verify it belongs to the user
    const category = await prisma.category.findFirst({
      where: {
        id: categoryId,
        userId: userId,
        groupId: null,
      },
    });

    if (!category) {
      return res.status(404).json({ message: 'Categoría no encontrada o sin permisos' });
    }

    // Check if trying to update name and it already exists
    if (parsed.data.name && parsed.data.name !== category.name) {
      const existing = await prisma.category.findFirst({
        where: {
          name: parsed.data.name,
          userId: userId,
          groupId: null,
        },
      });

      if (existing) {
        return res.status(409).json({ message: 'Ya existe una categoría personal con ese nombre' });
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
    return res.status(500).json({ message: 'Error actualizando categoría' });
  }
});

// DELETE /categories/:id - Delete a personal category
categoriesRouter.delete('/categories/:id', requireAuth, async (req, res) => {
  const userId = res.locals.userId as string;
  const categoryId = req.params.id;

  try {
    // Find the category and verify it belongs to the user
    const category = await prisma.category.findFirst({
      where: {
        id: categoryId,
        userId: userId,
        groupId: null,
      },
    });

    if (!category) {
      return res.status(404).json({ message: 'Categoría no encontrada o sin permisos' });
    }

    // Delete the category
    await prisma.category.delete({
      where: { id: categoryId },
    });

    return res.json({ message: 'Categoría eliminada correctamente' });
  } catch (error) {
    return res.status(500).json({ message: 'Error eliminando categoría' });
  }
});

// POST /groups/:id/categories - Create a group category
categoriesRouter.post('/groups/:id/categories', requireAuth, async (req, res) => {
  const userId = res.locals.userId as string;
  const groupId = req.params.id;

  // Validate group access
  const group = await prisma.group.findFirst({
    where: {
      id: groupId,
      OR: [{ ownerUserId: userId }, { members: { some: { userId } } }],
    },
  });

  if (!group) {
    return res.status(404).json({ message: 'Grupo no encontrado' });
  }

  const parsed = createCategorySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Datos inválidos', details: parsed.error.format() });
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
      return res.status(409).json({ message: 'Ya existe una categoría en el grupo con ese nombre' });
    }
    return res.status(500).json({ message: 'Error creando categoría de grupo' });
  }
});

// PATCH /groups/:groupId/categories/:id - Update a group category
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
    return res.status(400).json({ message: 'Datos inválidos', details: parsed.error.format() });
  }

  try {
    // Validate group access
    const group = await prisma.group.findFirst({
      where: {
        id: groupId,
        OR: [{ ownerUserId: userId }, { members: { some: { userId } } }],
      },
    });

    if (!group) {
      return res.status(404).json({ message: 'Grupo no encontrado' });
    }

    // Find the category and verify it belongs to the group
    const category = await prisma.category.findFirst({
      where: {
        id: categoryId,
        groupId: groupId,
      },
    });

    if (!category) {
      return res.status(404).json({ message: 'Categoría no encontrada o sin permisos' });
    }

    // Check if trying to update name and it already exists in this group
    if (parsed.data.name && parsed.data.name !== category.name) {
      const existing = await prisma.category.findFirst({
        where: {
          name: parsed.data.name,
          groupId: groupId,
        },
      });

      if (existing) {
        return res.status(409).json({ message: 'Ya existe una categoría en el grupo con ese nombre' });
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
    return res.status(500).json({ message: 'Error actualizando categoría' });
  }
});

// DELETE /groups/:groupId/categories/:id - Delete a group category
categoriesRouter.delete('/groups/:groupId/categories/:id', requireAuth, async (req, res) => {
  const userId = res.locals.userId as string;
  const groupId = req.params.groupId;
  const categoryId = req.params.id;

  try {
    // Validate group access
    const group = await prisma.group.findFirst({
      where: {
        id: groupId,
        OR: [{ ownerUserId: userId }, { members: { some: { userId } } }],
      },
    });

    if (!group) {
      return res.status(404).json({ message: 'Grupo no encontrado' });
    }

    // Find the category and verify it belongs to the group
    const category = await prisma.category.findFirst({
      where: {
        id: categoryId,
        groupId: groupId,
      },
    });

    if (!category) {
      return res.status(404).json({ message: 'Categoría no encontrada o sin permisos' });
    }

    // Delete the category
    await prisma.category.delete({
      where: { id: categoryId },
    });

    return res.json({ message: 'Categoría eliminada correctamente' });
  } catch (error) {
    return res.status(500).json({ message: 'Error eliminando categoría' });
  }
});
