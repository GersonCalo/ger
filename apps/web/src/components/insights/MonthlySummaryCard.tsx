import { SectionCard } from '@/components/SectionCard';
import { formatMoney } from '@/lib/format';
import type { MonthlySummary } from '@/types';

type MonthlySummaryCardProps = {
  summary: MonthlySummary | null;
  currency: string;
  onGenerateAiSummary?: () => void;
  aiSummary?: string | null;
  aiSummaryBusy?: boolean;
};

export const MonthlySummaryCard = ({
  summary,
  currency,
  onGenerateAiSummary,
  aiSummary,
  aiSummaryBusy,
}: MonthlySummaryCardProps) => {
  if (!summary) return null;

  const delta = summary.expenseDeltaPercent;

  return (
    <SectionCard title="Resumen del mes">
      <div className="monthly-summary">
        <div className="monthly-summary__row">
          <div>
            <div className="monthly-summary__label">Gastado</div>
            <div className="monthly-summary__value">{formatMoney(summary.expense, currency)}</div>
          </div>
          {delta !== null && (
            <div className={`monthly-summary__delta ${delta > 0 ? 'monthly-summary__delta--up' : 'monthly-summary__delta--down'}`}>
              {delta > 0 ? '+' : ''}
              {delta}% vs mes anterior
            </div>
          )}
        </div>

        {summary.topCategory && (
          <div className="monthly-summary__row">
            <div>
              <div className="monthly-summary__label">Mayor gasto</div>
              <div className="monthly-summary__value monthly-summary__value--small">{summary.topCategory.name}</div>
            </div>
            <div className="monthly-summary__amount">{formatMoney(summary.topCategory.amount, currency)}</div>
          </div>
        )}

        {summary.tips.length > 0 && (
          <ul className="monthly-summary__tips">
            {summary.tips.map(tip => (
              <li key={tip.id} className="monthly-summary__tip">
                {tip.message}
              </li>
            ))}
          </ul>
        )}

        {aiSummary ? (
          <p className="monthly-summary__ai">{aiSummary}</p>
        ) : (
          onGenerateAiSummary && (
            <button
              type="button"
              className="button button--ghost button--small"
              onClick={onGenerateAiSummary}
              disabled={aiSummaryBusy}
            >
              ✨ Análisis inteligente
            </button>
          )
        )}
      </div>
    </SectionCard>
  );
};
