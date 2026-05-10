import { useCallback, useState } from 'react';
import { api } from '@/lib/api';
import type { Category } from '@/types';

type UseCategoriesParams = {
  token: string | null;
};

const sortCategories = (categories: Category[]) =>
  [...categories].sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name));

export const useCategories = ({ token }: UseCategoriesParams) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoriesBusy, setCategoriesBusy] = useState(false);

  const reset = useCallback(() => {
    setCategories([]);
    setCategoriesBusy(false);
  }, []);

  const hydrate = useCallback((next: Category[]) => {
    setCategories(next);
  }, []);

  const refreshCategories = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!token) return [] as Category[];
      if (!options?.silent) setCategoriesBusy(true);
      try {
        const next = await api.getCategories(token);
        setCategories(next);
        return next;
      } catch (error) {
        console.error('Error fetching categories:', error);
        return [] as Category[];
      } finally {
        if (!options?.silent) setCategoriesBusy(false);
      }
    },
    [token]
  );

  const createCategory = useCallback(
    async (input: { name: string; type: 'income' | 'expense'; color?: string; icon?: string }) => {
      if (!token) throw new Error('No auth');
      const cat = await api.createCategory(token, input);
      setCategories(prev => sortCategories([...prev, cat]));
      return cat;
    },
    [token]
  );

  const updateCategory = useCallback(
    async (categoryId: string, input: { name?: string; color?: string; icon?: string }) => {
      if (!token) throw new Error('No auth');
      const cat = await api.updateCategory(token, categoryId, input);
      setCategories(prev => sortCategories(prev.map(c => (c.id === categoryId ? cat : c))));
      return cat;
    },
    [token]
  );

  const deleteCategory = useCallback(
    async (categoryId: string) => {
      if (!token) throw new Error('No auth');
      await api.deleteCategory(token, categoryId);
      setCategories(prev => prev.filter(c => c.id !== categoryId));
    },
    [token]
  );

  const createGroupCategory = useCallback(
    async (groupId: string, input: { name: string; type: 'income' | 'expense'; color?: string; icon?: string }) => {
      if (!token) throw new Error('No auth');
      const cat = await api.createGroupCategory(token, groupId, input);
      setCategories(prev => sortCategories([...prev, cat].filter((v, i, a) => a.findIndex(t => t.id === v.id) === i)));
      return cat;
    },
    [token]
  );

  const updateGroupCategory = useCallback(
    async (groupId: string, categoryId: string, input: { name?: string; color?: string; icon?: string }) => {
      if (!token) throw new Error('No auth');
      const cat = await api.updateGroupCategory(token, groupId, categoryId, input);
      setCategories(prev => sortCategories(prev.map(c => (c.id === categoryId ? cat : c))));
      return cat;
    },
    [token]
  );

  const deleteGroupCategory = useCallback(
    async (groupId: string, categoryId: string) => {
      if (!token) throw new Error('No auth');
      await api.deleteGroupCategory(token, groupId, categoryId);
      setCategories(prev => prev.filter(c => c.id !== categoryId));
    },
    [token]
  );

  return {
    categories,
    categoriesBusy,
    createCategory,
    updateCategory,
    deleteCategory,
    createGroupCategory,
    updateGroupCategory,
    deleteGroupCategory,
    refreshCategories,
    hydrate,
    reset,
  };
};
