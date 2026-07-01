import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { MonthlySummary } from '@/types';

export const useInsights = ({ token }: { token: string | null }) => {
  const [monthlySummary, setMonthlySummary] = useState<MonthlySummary | null>(null);
  const [insightsBusy, setInsightsBusy] = useState(false);

  const refreshInsights = useCallback(async () => {
    if (!token) return;
    setInsightsBusy(true);
    try {
      setMonthlySummary(await api.monthlySummary(token));
    } catch {
      // El resumen es informativo: si falla no bloqueamos el dashboard.
    } finally {
      setInsightsBusy(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) {
      void refreshInsights();
    } else {
      setMonthlySummary(null);
    }
  }, [token, refreshInsights]);

  return { monthlySummary, insightsBusy, refreshInsights };
};
