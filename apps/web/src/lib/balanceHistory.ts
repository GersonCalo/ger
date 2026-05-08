import type { Transaction } from '@/types';

export type BalancePoint = {
  date: string;
  balance: number;
};

export type PeriodKey = '1W' | '1M' | '3M' | '1Y' | 'ALL';

export const PERIOD_LABELS: Record<PeriodKey, string> = {
  '1W': '1S',
  '1M': '1M',
  '3M': '3M',
  '1Y': '1A',
  ALL: 'MAX',
};

export const PERIOD_DAYS: Record<PeriodKey, number> = {
  '1W': 7,
  '1M': 30,
  '3M': 90,
  '1Y': 365,
  ALL: Infinity,
};

/**
 * Calculates cumulative balance history from transactions.
 * Returns sorted array of { date, balance } points.
 */
export const calculateBalanceHistory = (
  transactions: Transaction[]
): BalancePoint[] => {
  const sorted = [...transactions].sort(
    (a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime()
  );

  const history: BalancePoint[] = [];
  let balance = 0;

  for (const tx of sorted) {
    const amount = Number(tx.amount) || 0;
    balance += tx.type === 'income' ? amount : -amount;

    // Extract YYYY-MM-DD from ISO string
    const dateStr = tx.occurredAt.slice(0, 10);
    const lastPoint = history[history.length - 1];

    if (lastPoint && lastPoint.date === dateStr) {
      // Same day: update the last point with current cumulative balance
      history[history.length - 1] = { date: dateStr, balance };
    } else {
      history.push({ date: dateStr, balance });
    }
  }

  return history;
};

/**
 * Filters balance history to a specific time period.
 * Uses local date comparison (YYYY-MM-DD) to avoid UTC issues.
 */
export const filterByPeriod = (
  history: BalancePoint[],
  period: PeriodKey
): BalancePoint[] => {
  if (period === 'ALL' || history.length === 0) {
    console.log(`🔍 [filterByPeriod] period=${period} | returning ${history.length} pts (no filter)`);
    return history;
  }

  const days = PERIOD_DAYS[period];
  const now = new Date();
  // Build cutoff as local date string to match history date format
  const cutoffDate = new Date(now);
  cutoffDate.setDate(cutoffDate.getDate() - days);
  // Format as YYYY-MM-DD using local components (not UTC)
  const cutoffStr = cutoffDate.getFullYear() + '-' +
    String(cutoffDate.getMonth() + 1).padStart(2, '0') + '-' +
    String(cutoffDate.getDate()).padStart(2, '0');

  console.log(`🔍 [filterByPeriod] period=${period} | days=${days} | now=${now.toISOString().slice(0,10)} | cutoffStr=${cutoffStr}`);
  console.log(`🔍 [filterByPeriod] history first date=${history[0]?.date} | last date=${history[history.length-1]?.date}`);

  // Find the first point at or after cutoff
  const startIndex = history.findIndex((p) => {
    const match = p.date >= cutoffStr;
    return match;
  });

  console.log(`🔍 [filterByPeriod] startIndex=${startIndex} | result count=${history.length - Math.max(0, startIndex - 1)}`);

  if (startIndex === -1) {
    console.warn(`⚠️ [filterByPeriod] No points found after cutoff, returning all`);
    return history;
  }

  // Include the point before cutoff as the starting baseline
  const start = Math.max(0, startIndex - 1);

  return history.slice(start);
};

/**
 * Generates smooth SVG path coordinates from balance points.
 * Uses Catmull-Rom spline interpolation for smooth curves.
 */
export const generateSmoothPath = (
  points: Array<{ x: number; y: number }>,
  tension: number = 0.4
): string => {
  if (points.length < 2) return '';

  const path: string[] = [];
  path.push(`M ${points[0].x} ${points[0].y}`);

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(i - 1, 0)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(i + 2, points.length - 1)];

    const cp1x = p1.x + (p2.x - p0.x) * tension;
    const cp1y = p1.y + (p2.y - p0.y) * tension;
    const cp2x = p2.x - (p3.x - p1.x) * tension;
    const cp2y = p2.y - (p3.y - p1.y) * tension;

    path.push(`C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`);
  }

  return path.join(' ');
};

/**
 * Formats a short period label for display.
 */
export const formatPeriodLabel = (startDate: string, endDate: string): string => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);

  if (diffDays < 1) return 'Hoy';
  if (diffDays < 7) return `${Math.round(diffDays)}d`;
  if (diffDays < 30) return `${Math.round(diffDays / 7)} sem`;
  if (diffDays < 365) return `${Math.round(diffDays / 30)} mes${Math.round(diffDays / 30) > 1 ? 'es' : ''}`;
  return `${Math.round(diffDays / 365)} aÃ±o${Math.round(diffDays / 365) > 1 ? 's' : ''}`;
};
