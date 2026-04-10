import { prisma } from '../db/prisma.js';
import { GLOBAL_CATEGORIES } from './globalCategories.js';

export const ensureGlobalCategories = async () => {
  for (const category of GLOBAL_CATEGORIES) {
    const existing = await prisma.category.findFirst({
      where: {
        name: category.name,
        type: category.type,
        userId: null,
        groupId: null,
      },
      select: { id: true },
    });

    if (existing) {
      await prisma.category.update({
        where: { id: existing.id },
        data: {
          color: category.color,
          icon: category.icon,
        },
      });
      continue;
    }

    await prisma.category.create({
      data: {
        name: category.name,
        type: category.type,
        color: category.color,
        icon: category.icon,
        userId: null,
        groupId: null,
      },
    });
  }
};
