import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { GroupsScreen } from '@/screens/GroupsScreen';
import type { UseFinanceAppReturn } from '@/hooks/useFinanceApp';

type GroupDetailScreenProps = {
  financeApp: UseFinanceAppReturn;
};

export const GroupDetailScreen = ({ financeApp }: GroupDetailScreenProps) => {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();

  useEffect(() => {
    if (groupId && groupId !== financeApp.selectedGroupId) {
      financeApp.setSelectedGroupId(groupId);
    }
  }, [groupId]);

  const handleSelectGroup = (id: string) => {
    financeApp.setSelectedGroupId(id);
  };

  const handleBackToList = () => {
    navigate('/groups');
  };

  return (
    <GroupsScreen
      error={financeApp.groupsError}
      groups={financeApp.groups}
      groupsBusy={financeApp.groupsBusy}
      onAddMember={financeApp.addGroupMember}
      onDeleteMember={financeApp.deleteGroupMember}
      onAddExpense={financeApp.addGroupExpense}
      onCreateGroup={financeApp.createGroup}
      onCreateSettlement={financeApp.createSettlement}
      onJoinByCode={financeApp.joinGroupByCode}
      onSelectGroup={handleSelectGroup}
      onUpdateExpense={financeApp.updateGroupExpense}
      onCreateGroupCategory={financeApp.createGroupCategory}
      onUpdateGroupCategory={financeApp.updateGroupCategory}
      onDeleteGroupCategory={financeApp.deleteGroupCategory}
      selectedGroupData={financeApp.selectedGroupData}
      selectedGroupId={financeApp.selectedGroupId}
      selectedGroupJoinCode={financeApp.selectedGroupJoinCode}
      user={financeApp.user!}
      categories={financeApp.categories}
      routeGroupId={groupId || null}
      onBackToList={handleBackToList}
    />
  );
};
