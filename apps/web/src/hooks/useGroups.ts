import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import type { AuthUser, GroupBalancesPayload, GroupExpenseSplitInput, GroupSummary } from '@/types';

type UseGroupsParams = {
  token: string | null;
  user: AuthUser | null;
  setActiveTab: (tab: 'home' | 'transactions' | 'groups' | 'profile') => void;
  refreshBalance: (options?: { silent?: boolean }) => Promise<any>;
  refreshTransactions: (options?: { silent?: boolean; filters?: any }) => Promise<void>;
};

const generateIdempotencyKey = (): string => {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
};

export const useGroups = ({ token, user, setActiveTab, refreshBalance, refreshTransactions }: UseGroupsParams) => {
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const groupsRef = useRef<GroupSummary[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [selectedGroupData, setSelectedGroupData] = useState<GroupBalancesPayload | null>(null);
  const [selectedGroupJoinCode, setSelectedGroupJoinCode] = useState<string | null>(null);
  const [groupsBusy, setGroupsBusy] = useState(false);
  const [groupsError, setGroupsError] = useState<string | null>(null);

  useEffect(() => {
    groupsRef.current = groups;
  }, [groups]);

  const clearSelectedGroup = useCallback(() => {
    setSelectedGroupData(null);
    setSelectedGroupJoinCode(null);
  }, []);

  const reset = useCallback(() => {
    setGroups([]);
    setSelectedGroupId(null);
    clearSelectedGroup();
    setGroupsBusy(false);
    setGroupsError(null);
  }, [clearSelectedGroup]);

  const hydrate = useCallback((nextGroups: GroupSummary[]) => {
    setGroups(nextGroups);
    setSelectedGroupId(current =>
      current && nextGroups.some(group => group.id === current) ? current : (nextGroups[0]?.id ?? null)
    );
  }, []);

  const refreshGroups = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!token) return [] as GroupSummary[];
      if (!options?.silent) {
        setGroupsBusy(true);
        setGroupsError(null);
      }

      try {
        const nextGroups = await api.groups(token);
        setGroups(nextGroups);
        setSelectedGroupId(current =>
          current && nextGroups.some(group => group.id === current) ? current : (nextGroups[0]?.id ?? null)
        );
        return nextGroups;
      } catch (error) {
        if (!options?.silent) {
          setGroupsError(error instanceof Error ? error.message : 'No se pudieron cargar los grupos');
        }
        return [] as GroupSummary[];
      } finally {
        if (!options?.silent) {
          setGroupsBusy(false);
        }
      }
    },
    [token]
  );

  const refreshSelectedGroup = useCallback(
    async (groupId: string, options?: { silent?: boolean; groupsSource?: GroupSummary[] }) => {
      if (!token) return null;
      if (!options?.silent) {
        setGroupsBusy(true);
        setGroupsError(null);
      }
      try {
        const source = options?.groupsSource || groupsRef.current;
        const selectedGroup = source.find(group => group.id === groupId);
        const currentMembership = selectedGroup?.members.find(member => member.userId === user?.id);
        const shouldLoadJoinCode = currentMembership?.role === 'admin';

        const [payload, joinCodePayload] = await Promise.all([
          api.groupBalances(token, groupId),
          shouldLoadJoinCode ? api.groupJoinCode(token, groupId).catch(() => null) : Promise.resolve(null),
        ]);
        setSelectedGroupData(payload);
        setSelectedGroupJoinCode(joinCodePayload?.joinCode || null);
        return payload;
      } catch (error) {
        if (!options?.silent) {
          setGroupsError(error instanceof Error ? error.message : 'No se pudo cargar el detalle del grupo');
        }
        setSelectedGroupJoinCode(null);
        return null;
      } finally {
        if (!options?.silent) {
          setGroupsBusy(false);
        }
      }
    },
    [token, user?.id]
  );

  useEffect(() => {
    if (!selectedGroupId || !token) {
      clearSelectedGroup();
      return;
    }
    refreshSelectedGroup(selectedGroupId);
  }, [clearSelectedGroup, refreshSelectedGroup, selectedGroupId, token]);

  const createGroup = useCallback(
    async (input: { name: string; guestMembers: string[] }) => {
      if (!token) return;
      setGroupsBusy(true);
      setGroupsError(null);
      try {
        const createdGroup = await api.createGroup(token, {
          name: input.name,
          members: input.guestMembers
            .filter(Boolean)
            .map(displayName => ({ displayName, weight: 1, role: 'member' as const })),
        });
        await refreshGroups();
        setSelectedGroupId(createdGroup.id);
        setActiveTab('groups');
        await Promise.all([refreshSelectedGroup(createdGroup.id), refreshBalance()]);
      } catch (error) {
        setGroupsError(error instanceof Error ? error.message : 'No se pudo crear el grupo');
      } finally {
        setGroupsBusy(false);
      }
    },
    [refreshBalance, refreshGroups, refreshSelectedGroup, setActiveTab, token]
  );

  const addGroupExpense = useCallback(
    async (input: {
      groupId: string;
      description: string;
      amount: number;
      payerMemberId: string;
      categoryId?: string;
      splitMethod: 'equal' | 'manual' | 'weights';
      splits?: GroupExpenseSplitInput[];
      occurredAt: string;
    }) => {
      if (!token) return;
      setGroupsBusy(true);
      setGroupsError(null);
      try {
        const { groupId, ...rest } = input;
        await api.createGroupExpense(token, groupId, { ...rest, idempotencyKey: generateIdempotencyKey() });
        await Promise.all([
          refreshSelectedGroup(groupId, { silent: true }),
          refreshBalance({ silent: true }),
          refreshTransactions({ silent: true }),
        ]);
      } catch (error) {
        setGroupsError(error instanceof Error ? error.message : 'No se pudo crear el gasto');
        throw error;
      } finally {
        setGroupsBusy(false);
      }
    },
    [refreshBalance, refreshSelectedGroup, refreshTransactions, token]
  );

  const updateGroupExpense = useCallback(
    async (input: {
      expenseId: string;
      groupId: string;
      description: string;
      amount: number;
      payerMemberId: string;
      categoryId?: string;
      splitMethod: 'equal' | 'manual' | 'weights';
      splits?: GroupExpenseSplitInput[];
      occurredAt: string;
    }) => {
      if (!token) return;
      setGroupsBusy(true);
      setGroupsError(null);
      try {
        const { groupId, expenseId, ...rest } = input;
        await api.updateGroupExpense(token, groupId, expenseId, rest);
        await Promise.all([
          refreshSelectedGroup(groupId, { silent: true }),
          refreshBalance({ silent: true }),
          refreshTransactions({ silent: true }),
        ]);
      } catch (error) {
        setGroupsError(error instanceof Error ? error.message : 'No se pudo actualizar el gasto');
        throw error;
      } finally {
        setGroupsBusy(false);
      }
    },
    [refreshBalance, refreshSelectedGroup, refreshTransactions, token]
  );

  const addGroupMember = useCallback(
    async (input: { groupId: string; displayName: string }) => {
      if (!token) return;
      setGroupsBusy(true);
      setGroupsError(null);
      try {
        await api.createGroupMember(token, input.groupId, { displayName: input.displayName, weight: 1 });
        await Promise.all([refreshGroups(), refreshSelectedGroup(input.groupId)]);
      } catch (error) {
        setGroupsError(error instanceof Error ? error.message : 'No se pudo anadir el miembro');
      } finally {
        setGroupsBusy(false);
      }
    },
    [refreshGroups, refreshSelectedGroup, token]
  );

  const deleteGroupMember = useCallback(
    async (groupId: string, memberId: string) => {
      if (!token) return;
      setGroupsBusy(true);
      setGroupsError(null);
      try {
        await api.deleteGroupMember(token, groupId, memberId);
        await Promise.all([refreshGroups(), refreshSelectedGroup(groupId)]);
      } catch (error) {
        setGroupsError(error instanceof Error ? error.message : 'No se pudo eliminar el miembro');
      } finally {
        setGroupsBusy(false);
      }
    },
    [refreshGroups, refreshSelectedGroup, token]
  );

  const joinGroupByCode = useCallback(
    async (code: string) => {
      if (!token) return;
      setGroupsBusy(true);
      setGroupsError(null);
      try {
        const { group: joinedGroup } = await api.joinGroupByCode(token, code.trim().toUpperCase());
        await Promise.all([refreshGroups(), refreshBalance()]);
        setSelectedGroupId(joinedGroup.id);
        await refreshSelectedGroup(joinedGroup.id);
        setActiveTab('groups');
      } catch (error) {
        setGroupsError(error instanceof Error ? error.message : 'No se pudo unir al grupo');
      } finally {
        setGroupsBusy(false);
      }
    },
    [refreshBalance, refreshGroups, refreshSelectedGroup, setActiveTab, token]
  );

  const createSettlement = useCallback(
    async (input: { groupId: string; fromMemberId: string; toMemberId: string; amount: number }) => {
      if (!token) return;
      setGroupsBusy(true);
      setGroupsError(null);
      try {
        await api.createSettlement(token, input.groupId, {
          fromMemberId: input.fromMemberId,
          toMemberId: input.toMemberId,
          amount: input.amount,
          occurredAt: new Date().toISOString(),
          idempotencyKey: generateIdempotencyKey(),
        });
        await Promise.all([refreshSelectedGroup(input.groupId), refreshBalance(), refreshTransactions({ silent: true })]);
      } catch (error) {
        setGroupsError(error instanceof Error ? error.message : 'No se pudo crear la liquidacion');
      } finally {
        setGroupsBusy(false);
      }
    },
    [refreshBalance, refreshSelectedGroup, refreshTransactions, token]
  );

  const confirmSettlement = useCallback(
    async (groupId: string, settlementId: string) => {
      if (!token) return;
      setGroupsBusy(true);
      setGroupsError(null);
      try {
        await api.updateSettlementStatus(token, groupId, settlementId, 'confirmed');
        await Promise.all([refreshSelectedGroup(groupId), refreshBalance(), refreshTransactions({ silent: true })]);
      } catch (error) {
        setGroupsError(error instanceof Error ? error.message : 'No se pudo confirmar la liquidacion');
      } finally {
        setGroupsBusy(false);
      }
    },
    [refreshBalance, refreshSelectedGroup, refreshTransactions, token]
  );

  return {
    groups,
    selectedGroupId,
    selectedGroupData,
    selectedGroupJoinCode,
    groupsBusy,
    groupsError,
    setSelectedGroupId,
    clearSelectedGroup,
    createGroup,
    addGroupExpense,
    updateGroupExpense,
    addGroupMember,
    deleteGroupMember,
    joinGroupByCode,
    createSettlement,
    confirmSettlement,
    refreshGroups,
    refreshSelectedGroup,
    hydrate,
    reset,
  };
};
