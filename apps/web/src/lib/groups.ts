import type { GroupSummary } from '@/types';

export const summarizeTransactions = (group: GroupSummary) =>
  group.expenses.reduce(
    (summary, expense) => {
      summary.total += expense.amount;
      summary.count += 1;
      return summary;
    },
    { total: 0, count: 0 }
  );
