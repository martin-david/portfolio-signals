import type { PortfolioAnalysisDto, PortfolioDto } from '@/api/schema';
import type { VerdictKey } from '@/ui/tokens';

import { verdictMeta } from './verdicts';

export type StripKey = VerdictKey | 'cash';

export interface StripSegment {
  key: StripKey;
  /** Legend name. */
  name: string;
  /** What the segment holds, for the legend: symbols, or a description. */
  detail: string;
  value: number;
  /** Share of the whole account, in percent. */
  pct: number;
}

const GROUPS: { key: StripKey; name: string; verdicts: string[] }[] = [
  { key: 'size', name: 'Hold, review size', verdicts: ['HoldReviewSize'] },
  { key: 'hold', name: 'Hold', verdicts: ['Hold'] },
  { key: 'watch', name: 'Watch', verdicts: ['Watch'] },
  { key: 'review', name: 'Review', verdicts: ['Review'] },
  { key: 'nodata', name: 'No analyst data', verdicts: ['NoData'] },
];

/** How many symbols a legend line names before it says "and N more". */
export const LEGEND_SYMBOLS = 6;

function list(symbols: string[]): string {
  if (symbols.length <= LEGEND_SYMBOLS) {
    return symbols.join(', ');
  }
  return `${symbols.slice(0, LEGEND_SYMBOLS).join(', ')} and ${symbols.length - LEGEND_SYMBOLS} more`;
}

/**
 * The account value split by verdict, as the prototype's strip: every holding sits in the segment of its verdict,
 * and what the verdicts do not cover (copy trading and cash) is shown as its own segments so the strip adds up to
 * the whole account. Segments without value are left out.
 */
export function buildStripSegments(
  analysis: PortfolioAnalysisDto,
  account?: PortfolioDto['account'],
): StripSegment[] {
  const total = analysis.kpis.totalValue;
  const share = (value: number) => (total > 0 ? (value / total) * 100 : 0);
  const segments: StripSegment[] = [];

  for (const group of GROUPS) {
    const rows = analysis.holdings.filter((row) => group.verdicts.includes(row.assessment.verdict));
    const value = rows.reduce((sum, row) => sum + row.holding.value, 0);
    if (value > 0) {
      segments.push({
        key: group.key,
        name: group.name,
        detail: list(rows.map((row) => row.holding.symbol)),
        value,
        pct: share(value),
      });
    }
  }

  if (account) {
    if (account.copiedValue > 0) {
      segments.push({
        key: 'copy',
        name: 'Copy trading, not assessed',
        detail: 'Portfolios you copy on eToro',
        value: account.copiedValue,
        pct: share(account.copiedValue),
      });
    }
    if (account.availableCash > 0) {
      segments.push({
        key: 'cash',
        name: 'Cash',
        detail: 'Available to invest',
        value: account.availableCash,
        pct: share(account.availableCash),
      });
    }
  } else {
    const other = total - analysis.kpis.directValue;
    if (other > 0) {
      segments.push({
        key: 'copy',
        name: 'Copy trading and cash, not assessed',
        detail: 'Not part of the holdings',
        value: other,
        pct: share(other),
      });
    }
  }
  return segments;
}

/** The verdicts of the holdings, for the spoken summary of the strip. */
export function describeStrip(segments: readonly StripSegment[]): string {
  return segments.map((s) => `${s.name} ${s.pct.toFixed(0)} percent`).join(', ');
}

export function stripKeyOf(verdict: keyof typeof verdictMeta): StripKey {
  return verdictMeta[verdict].strip;
}
