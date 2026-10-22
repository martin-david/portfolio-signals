import type { PortfolioAnalysisDto } from '@/api/schema';
import { MINUS, formatPercent, formatShortDate, formatSignedPercent } from '@/lib/format';

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

/** Both targets are shown as a percent above or below the price, on this scale. */
export const TARGET_AXIS = { min: -60, max: 130, ticks: [-50, 0, 50, 100] } as const;

/** Keeps a mark off the very edge of its plot, so that it is not clipped. */
const PLOT_MARGIN = 8;

/** Where a value falls inside a plot of this width. A value off the scale sits on its end. */
export function axisX(
  value: number,
  axis: { min: number; max: number },
  width: number,
  margin = PLOT_MARGIN,
): number {
  const clamped = Math.min(Math.max(value, axis.min), axis.max);
  return margin + ((clamped - axis.min) / (axis.max - axis.min)) * (width - 2 * margin);
}

export interface TargetMarks {
  /** The average analyst target. */
  street: number;
  /** The AI-model target, when there is one. */
  ai: number | null;
  grid: { value: number; x: number }[];
}

export function targetMarks(row: TargetRow, width: number): TargetMarks {
  return {
    street: axisX(row.street, TARGET_AXIS, width),
    ai: row.ai === null ? null : axisX(row.ai, TARGET_AXIS, width),
    grid: TARGET_AXIS.ticks.map((value) => ({ value, x: axisX(value, TARGET_AXIS, width) })),
  };
}

/** The numbers behind a row of the targets chart, in words (the chart alone would not say them). */
export function describeTargets(row: TargetRow): string {
  const analysts =
    row.analysts === null
      ? ''
      : ` \u00b7 ${row.analysts} ${row.analysts === 1 ? 'analyst' : 'analysts'}`;
  return `Street ${formatSignedPercent(row.street)} \u00b7 AI ${row.ai === null ? 'n/a' : formatSignedPercent(row.ai)}${analysts}`;
}

function points(value: number): string {
  return `${value < 0 ? MINUS : '+'}${Math.abs(Math.round(value))}`;
}

/** The caption under the targets chart: where the Street and the AI models split, and where they agree. */
export function describeGaps(gaps: TargetGaps): string {
  const parts = ['All values are a percent above or below today\u2019s price.'];
  const split = gaps.widest.filter((g) => g.gap > 5);
  if (split.length > 0) {
    parts.push(
      `The widest splits are ${split.map((g) => `${g.symbol} (${points(g.gap)} points)`).join(', ')}, where the Street is more optimistic than the models.`,
    );
  }
  if (gaps.agree.length > 0) {
    parts.push(`They roughly agree (within 5 points) on ${gaps.agree.join(', ')}.`);
  }
  return parts.join(' ');
}

/** The scale of the earnings chart: at least 50% of the account, in steps of 25. */
export function earningsScaleMax(days: readonly EarningsDay[]): number {
  const top = Math.max(0, ...days.map((day) => day.totalPct));
  return Math.max(50, Math.ceil(top / 25) * 25);
}

export function earningsTicks(scaleMax: number): number[] {
  return Array.from({ length: Math.floor(scaleMax / 25) + 1 }, (_, index) => index * 25);
}

export interface EarningsSegment {
  symbol: string;
  x: number;
  width: number;
  /** Wide enough to carry its symbol. */
  labelled: boolean;
}

const SEGMENT_GAP = 1.5;
const SEGMENT_MIN_WIDTH = 1.6;

/** The margin a label keeps either side of its letters inside its segment. */
export const LABEL_PADDING = 7;
/** What one letter of a label takes, with room to spare for a wider fallback font. */
const LABEL_CHAR_WIDTH = 7.5;

/** How wide a segment has to be to carry this name. */
export function labelWidth(symbol: string): number {
  return 2 * LABEL_PADDING + symbol.length * LABEL_CHAR_WIDTH;
}

/** One bar of the earnings chart: the holdings of a day side by side, each as wide as its share of the account. */
export function earningsSegments(
  day: EarningsDay,
  scaleMax: number,
  width: number,
): EarningsSegment[] {
  let x = 0;
  return day.items.map((item) => {
    const segment = Math.max((item.weightPct / scaleMax) * width, SEGMENT_MIN_WIDTH);
    const placed = {
      symbol: item.symbol,
      x,
      width: segment,
      labelled: segment >= labelWidth(item.symbol),
    };
    x += segment + SEGMENT_GAP;
    return placed;
  });
}

function list(symbols: readonly string[]): string {
  if (symbols.length <= 1) {
    return symbols.join('');
  }
  return `${symbols.slice(0, -1).join(', ')} and ${symbols[symbols.length - 1]}`;
}

function busiest(days: readonly EarningsDay[]): EarningsDay | undefined {
  return [...days].sort((a, b) => b.totalPct - a.totalPct)[0];
}

/** The heading of the earnings section: the answer when one day carries a large share of the account. */
export function earningsHeading(days: readonly EarningsDay[]): string {
  const top = busiest(days);
  return top && top.totalPct >= 40
    ? `${Math.round(top.totalPct)}% of the account reports on ${formatShortDate(top.date)}`
    : 'When your holdings report';
}

/** What to read from the earnings chart: the busiest day, and why it matters. */
export function earningsSummary(days: readonly EarningsDay[]): string {
  const top = busiest(days);
  if (!top) {
    return '';
  }
  const names = list(top.items.map((item) => item.symbol));
  const verb = top.items.length === 1 ? 'reports' : 'report';
  return `${names} ${verb} on ${formatShortDate(top.date)}, together ${formatPercent(top.totalPct)} of the account. Earnings days are where analyst targets get tested, so they are the natural moments to read the verdicts again.`;
}
