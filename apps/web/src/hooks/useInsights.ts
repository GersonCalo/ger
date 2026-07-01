import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import type { MonthlySummary } from '@/types';

export const useInsights = ({ token }: { token: string | null }) => {
  const [monthlySummary, setMonthlySummary] = useState<MonthlySummary | null>(null);
  const [insightsBusy, setInsightsBusy] = useState(false);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [aiSummaryBusy, setAiSummaryBusy] = useState(false);
  const [aiPaywallVisible, setAiPaywallVisible] = useState(false);

  const dismissAiPaywall = useCallback(() => setAiPaywallVisible(false), []);

  const generateAiSummary = useCallback(async () => {
    if (!token) return;
    setAiSummaryBusy(true);
    try {
      const insight = await api.generateAiSummary(token);
      setAiSummary(insight.content);
    } catch (error) {
      if (error instanceof ApiError && error.code === 'PLAN_LIMIT_REACHED') {
        setAiPaywallVisible(true);
      }
      // Otros errores no bloquean el dashboard: el análisis es opcional.
    } finally {
      setAiSummaryBusy(false);
    }
  }, [token]);

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
      setAiSummary(null);
      setAiPaywallVisible(false);
    }
  }, [token, refreshInsights]);

  return {
    monthlySummary,
    insightsBusy,
    refreshInsights,
    aiSummary,
    aiSummaryBusy,
    generateAiSummary,
    aiPaywallVisible,
    dismissAiPaywall,
  };
};
