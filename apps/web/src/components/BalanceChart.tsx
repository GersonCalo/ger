import { useMemo, useState } from 'react';
import {
  calculateBalanceHistory,
  filterByPeriod,
  generateSmoothPath,
  PERIOD_LABELS,
  type PeriodKey,
} from '@/lib/balanceHistory';
import { formatMoney } from '@/lib/format';
import type { Transaction } from '@/types';

const PERIODS: PeriodKey[] = ['1W', '1M', '3M', '1Y', 'ALL'];

type BalanceChartProps = {
  transactions: Transaction[];
  currency: string;
};

/**
 * Formats a date for the X-axis label.
 */
const formatDateLabel = (dateStr: string): string => {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
};

export const BalanceChart = ({ transactions, currency }: BalanceChartProps) => {
  const [period, setPeriod] = useState<PeriodKey>('1M');

  const chartData = useMemo(() => {
    console.log('📊 [BalanceChart] Render triggered | period:', period, '| transactions count:', transactions.length);

    const history = calculateBalanceHistory(transactions);
    console.log('📊 [BalanceChart] History calculated | points:', history.length);
    if (history.length > 0) {
      console.log('📊 [BalanceChart] History date range:', history[0].date, '→', history[history.length - 1].date);
    }

    const filtered = filterByPeriod(history, period);
    console.log('📊 [BalanceChart] Filtered | points:', filtered.length);
    if (filtered.length > 0) {
      console.log('📊 [BalanceChart] Filtered date range:', filtered[0].date, '→', filtered[filtered.length - 1].date);
      console.log('📊 [BalanceChart] Filtered balances:', filtered[0].balance, '→', filtered[filtered.length - 1].balance);
    }

    if (filtered.length < 2) {
      console.warn('⚠️ [BalanceChart] Not enough data points to render');
      return null;
    }

    // FIXED Y-axis: calculate from ALL history, not just filtered
    const allBalances = history.map((p) => p.balance);
    const allMin = Math.min(...allBalances);
    const allMax = Math.max(...allBalances);
    const allRange = allMax - allMin || 1;
    const padding = allRange * 0.1;
    const yMin = allMin - padding;
    const yMax = allMax + padding;
    const yRange = yMax - yMin;

    // SVG dimensions
    const width = 600;
    const height = 180;
    const xPadding = 4;
    const yPadding = 8;
    const chartHeight = height - yPadding * 2;

    // Map filtered points to SVG coordinates using FIXED Y range
    const points = filtered.map((p, i) => ({
      x: xPadding + (i / Math.max(filtered.length - 1, 1)) * (width - xPadding * 2),
      y: yPadding + (1 - (p.balance - yMin) / yRange) * chartHeight,
    }));

    const linePath = generateSmoothPath(points, 0.3);

    // Area path (closed path for gradient fill)
    const firstX = points[0].x;
    const lastX = points[points.length - 1].x;
    const bottomY = height;
    const areaPath = `${linePath} L ${lastX} ${bottomY} L ${firstX} ${bottomY} Z`;

    // Summary calculations from filtered data
    const startBalance = filtered[0].balance;
    const endBalance = filtered[filtered.length - 1].balance;
    const change = endBalance - startBalance;
    const changePercent = startBalance !== 0 ? (change / Math.abs(startBalance)) * 100 : 0;
    const isPositive = change >= 0;

    // Date labels for X-axis
    const startDate = filtered[0].date;
    const endDate = filtered[filtered.length - 1].date;
    const startDateLabel = formatDateLabel(startDate);
    const endDateLabel = formatDateLabel(endDate);

    // Y-axis labels
    const yMinLabel = formatMoney(yMin, currency);
    const yMaxLabel = formatMoney(yMax, currency);

    return {
      points,
      linePath,
      areaPath,
      width,
      height,
      bottomY,
      startBalance,
      endBalance,
      change,
      changePercent,
      isPositive,
      startDateLabel,
      endDateLabel,
      yMinLabel,
      yMaxLabel,
      pointCount: filtered.length,
    };
  }, [transactions, period, currency]);

  if (!chartData || transactions.length === 0) {
    return (
      <div className="balance-chart balance-chart--empty">
        <div className="balance-chart__placeholder">
          <span className="balance-chart__placeholder-icon">📊</span>
          <span className="balance-chart__placeholder-text">
            Añade movimientos para ver tu historial
          </span>
        </div>
      </div>
    );
  }

  const {
    linePath,
    areaPath,
    width,
    height,
    bottomY,
    change,
    changePercent,
    isPositive,
    startDateLabel,
    endDateLabel,
    yMinLabel,
    yMaxLabel,
    pointCount,
  } = chartData;

  const gradientId = isPositive ? 'chartGradientPositive' : 'chartGradientNegative';
  const strokeColor = isPositive ? 'var(--positive)' : 'var(--negative)';

  return (
    <div className="balance-chart">
      {/* Period selector */}
      <div className="balance-chart__header">
        <div className="balance-chart__periods">
          {PERIODS.map((p) => (
            <button
              key={p}
              type="button"
              className={`balance-chart__period-btn ${period === p ? 'balance-chart__period-btn--active' : ''}`}
              onClick={() => setPeriod(p)}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>
        <span className="balance-chart__count">{pointCount} días</span>
      </div>

      {/* SVG Chart with axes */}
      <div className="balance-chart__svg-wrapper">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="balance-chart__svg"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="chartGradientPositive" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--positive)" stopOpacity="0.2" />
              <stop offset="100%" stopColor="var(--positive)" stopOpacity="0.02" />
            </linearGradient>
            <linearGradient id="chartGradientNegative" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--negative)" stopOpacity="0.2" />
              <stop offset="100%" stopColor="var(--negative)" stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {/* Y-axis labels */}
          <text x="4" y="20" className="chart-label chart-label--y">{yMaxLabel}</text>
          <text x="4" y={height - 4} className="chart-label chart-label--y">{yMinLabel}</text>

          {/* Area fill */}
          <path d={areaPath} fill={`url(#${gradientId})`} />

          {/* Line */}
          <path
            d={linePath}
            fill="none"
            stroke={strokeColor}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* X-axis labels */}
          <text x="4" y={height - 14} className="chart-label chart-label--x">{startDateLabel}</text>
          <text x={width - 4} y={height - 14} textAnchor="end" className="chart-label chart-label--x">{endDateLabel}</text>
        </svg>
      </div>

      {/* Summary */}
      <div className="balance-chart__summary">
        <span className={`balance-chart__change ${isPositive ? 'balance-chart__change--positive' : 'balance-chart__change--negative'}`}>
          {isPositive ? '+' : ''}
          {formatMoney(change, currency)}
        </span>
        <span className={`balance-chart__change-pct ${isPositive ? 'balance-chart__change--positive' : 'balance-chart__change--negative'}`}>
          ({isPositive ? '+' : ''}
          {changePercent.toFixed(1)}%)
        </span>
      </div>
    </div>
  );
};
