import type { PortfolioAnalysisDto } from '@/api/schema';

import { verdictMeta } from './verdicts';

export interface EarningsItem {
  symbol: string;
  weightPct: number;
}

export interface EarningsDay {
  /** yyyy-mm-dd */
  date: string;
  items: EarningsItem[];
  totalPct: number;
}

/** How far ahead the earnings chart looks, as the report does. */
export const EARNINGS_WINDOW_DAYS = 70;

function dayNumber(isoDate: string): number {
  return Math.floor(Date.parse(`${isoDate.slice(0, 10)}T00:00:00Z`) / 86_400_000);
}

/**
 * Stocks reporting within the window, grouped by day with the biggest holding first, in date order. A day with a
 * large share of the account is the moment these signals get tested.
 */
export function earningsByDay(
  analysis: PortfolioAnalysisDto,
  windowDays = EARNINGS_WINDOW_DAYS,
): EarningsDay[] {
  const days = new Map<string, EarningsItem[]>();
  for (const row of analysis.holdings) {
    const { daysToEarnings, nextEarningsDate } = row.assessment.facts;
    if (
      row.holding.assetClass !== 'Stock' ||
      !nextEarningsDate ||
      daysToEarnings === null ||
      daysToEarnings < 0 ||
      daysToEarnings > windowDays
    ) {
      continue;
    }
    const date = nextEarningsDate.slice(0, 10);
    days.set(date, [
      ...(days.get(date) ?? []),
      { symbol: row.holding.symbol, weightPct: row.assessment.weightPct },
    ]);
  }
  return [...days.entries()]
    .sort(([a], [b]) => dayNumber(a) - dayNumber(b))
    .map(([date, items]) => {
      const sorted = [...items].sort((a, b) => b.weightPct - a.weightPct);
      return {
        date,
        items: sorted,
        totalPct: sorted.reduce((sum, item) => sum + item.weightPct, 0),
      };
    });
}

export interface TargetRow {
  symbol: string;
  weightPct: number;
  /** Average analyst target against the price, in percent. */
  street: number;
  /** TipRanks' AI-model target against the price, in percent, when there is one. */
  ai: number | null;
  analysts: number | null;
  verdict: keyof typeof verdictMeta;
}

/** Holdings whose target upside is trustworthy enough to score, biggest first. */
export function targetRows(analysis: PortfolioAnalysisDto): TargetRow[] {
  return analysis.holdings
    .filter(
      (row) =>
        row.assessment.components.upside !== null && row.assessment.facts.streetUpsidePct !== null,
    )
    .map((row) => ({
      symbol: row.holding.symbol,
      weightPct: row.assessment.weightPct,
      street: row.assessment.facts.streetUpsidePct as number,
      ai: row.assessment.facts.aiUpsidePct,
      analysts: row.assessment.facts.analystCount,
      verdict: row.assessment.verdict,
    }))
    .sort((a, b) => b.weightPct - a.weightPct);
}

export interface TargetGaps {
  /** The widest splits between the Street and the AI models, Street above AI first. */
  widest: { symbol: string; gap: number }[];
  /** Holdings where the two roughly agree (within 5 points). */
  agree: string[];
}

export function targetGaps(rows: readonly TargetRow[], widestCount = 3): TargetGaps {
  const gaps = rows
    .filter((row) => row.ai !== null)
    .map((row) => ({ symbol: row.symbol, gap: row.street - (row.ai as number) }));
  return {
    widest: [...gaps].sort((a, b) => b.gap - a.gap).slice(0, widestCount),
    agree: gaps.filter((g) => Math.abs(g.gap) <= 5).map((g) => g.symbol),
  };
}
