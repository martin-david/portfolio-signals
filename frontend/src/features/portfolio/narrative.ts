import type { AnalyzedHoldingDto, PortfolioAnalysisDto } from '@/api/schema';
import { capitalize, formatPercent, formatSignedPercent, words } from '@/lib/format';

/** A line of copy that may contain the user's own amounts, which the Amount component can hide. */
export type CopySegment = string | { amount: number; signed?: boolean };

export interface Finding {
  key: 'quality' | 'concentration' | 'timing' | 'housekeeping';
  title: string;
  body: CopySegment[];
}

export interface Headline {
  /** The answer, as one sentence. */
  headline: string;
  /** What lies behind it. */
  lede: string;
}

const isAttention = (row: AnalyzedHoldingDto) =>
  row.assessment.verdict === 'Watch' || row.assessment.verdict === 'Review';

function symbols(rows: AnalyzedHoldingDto[]): string {
  return rows.map((row) => row.holding.symbol).join(', ');
}

/**
 * The answer first: hold, watch or review, for the positions that matter (at least 1% of the account). The text is
 * generated from the verdicts, never written for a particular portfolio.
 */
export function buildHeadline(analysis: PortfolioAnalysisDto): Headline {
  const material = analysis.holdings.filter((row) => row.assessment.material);
  if (material.length === 0) {
    return {
      headline: 'No holding is above 1% of your account yet.',
      lede: 'Verdicts matter most for positions that move the account, so there is nothing to decide here.',
    };
  }
  if (material.every((row) => row.assessment.verdict === 'NoData')) {
    return {
      headline: 'Analyst signals have not arrived yet.',
      lede: 'Connect TipRanks and run a sync to see a verdict for each holding. Until then every position reads No data.',
    };
  }

  const attention = material.filter(isAttention);
  const size = material.filter((row) => row.assessment.verdict === 'HoldReviewSize');
  const review = attention.filter((row) => row.assessment.verdict === 'Review');
  const watch = attention.filter((row) => row.assessment.verdict === 'Watch');

  if (attention.length === 0) {
    if (size.length === 0) {
      return {
        headline: 'Analysts back every position that matters.',
        lede: `Every holding above 1% of your account is a Hold. Size and price are still yours to judge, because the data cannot see them.`,
      };
    }
    const largest = size[0];
    return {
      headline: 'Analysts back every position that matters. What is left to decide is size.',
      lede: `${largest.holding.symbol} is ${formatPercent(largest.assessment.weightPct)} of your account. Its verdict is Hold, but a position this large is a decision about size, not about analysts.`,
    };
  }

  const count = capitalize(words(attention.length));
  const headline =
    attention.length === 1
      ? 'One position above 1% deserves a second look.'
      : `${count} positions above 1% deserve a second look.`;
  const parts: string[] = [];
  if (review.length > 0) {
    parts.push(`Review: ${symbols(review)}.`);
  }
  if (watch.length > 0) {
    parts.push(`Watch: ${symbols(watch)}.`);
  }
  if (size.length > 0) {
    parts.push(
      `${symbols(size)} ${size.length === 1 ? 'is a Hold but is' : 'are Holds but are'} also large enough to review for size.`,
    );
  }
  parts.push('Review means look again, not sell.');
  return { headline, lede: parts.join(' ') };
}

function assessedShares(analysis: PortfolioAnalysisDto): { assessed: number; hold: number } {
  let assessed = 0;
  let hold = 0;
  for (const row of analysis.holdings) {
    if (row.assessment.verdict === 'NoData') {
      continue;
    }
    assessed += row.holding.value;
    if (row.assessment.verdict === 'Hold' || row.assessment.verdict === 'HoldReviewSize') {
      hold += row.holding.value;
    }
  }
  return { assessed, hold };
}

/** Up to four findings (quality, concentration, timing, housekeeping), each from the portfolio KPIs. */
export function buildFindings(analysis: PortfolioAnalysisDto): Finding[] {
  const { kpis } = analysis;
  const findings: Finding[] = [];

  const { assessed, hold } = assessedShares(analysis);
  if (assessed > 0) {
    const holdShare = (hold / assessed) * 100;
    const title =
      holdShare >= 75
        ? 'Quality is not the question.'
        : holdShare >= 50
          ? 'Most of the assessed account is backed.'
          : 'Much of the assessed account needs a look.';
    const score =
      kpis.weightedSmartScore === null
        ? ''
        : ` Weighted by value, the Smart Score of your stocks is ${kpis.weightedSmartScore.toFixed(1)} out of 10.`;
    const upside =
      kpis.weightedStreetUpsidePct === null
        ? ''
        : ` The average analyst target sits ${formatSignedPercent(kpis.weightedStreetUpsidePct)} from the price, weighted by value.`;
    findings.push({
      key: 'quality',
      title,
      body: [
        `${formatPercent(holdShare, 0)} of the value TipRanks covers is in holdings with a Hold verdict.${score}${upside}`,
      ],
    });
  }

  if (kpis.positions > 0) {
    const concentrated = kpis.top1Pct >= 25 || kpis.top5Pct >= 60;
    findings.push({
      key: 'concentration',
      title: concentrated ? 'Concentration is.' : 'Concentration is moderate.',
      body: [
        `Your largest position is ${formatPercent(kpis.top1Pct)} of the account and the top five are ${formatPercent(kpis.top5Pct)}. The account behaves like about ${Math.round(kpis.effectivePositions)} equal-sized positions.`,
      ],
    });
  }

  const earnings = kpis.earnings30DaysSymbols;
  findings.push(
    earnings.length > 0
      ? {
          key: 'timing',
          title: 'Timing is.',
          body: [
            `${capitalize(words(earnings.length))} of your holdings ${earnings.length === 1 ? 'reports' : 'report'} earnings within 30 days (${earnings.join(', ')}), together ${formatPercent(kpis.earnings30DaysPct)} of the account.`,
          ],
        }
      : {
          key: 'timing',
          title: 'No earnings within 30 days.',
          body: ['None of your stocks reports earnings in the next 30 days.'],
        },
  );

  const small = kpis.smallPositions;
  if (small.count > 0) {
    findings.push({
      key: 'housekeeping',
      title: 'Housekeeping is cheap.',
      body: [
        `${capitalize(words(small.count))} of your ${kpis.positions} positions ${small.count === 1 ? 'is' : 'are each'} under 1% of the account; together they are ${formatPercent(small.pct)} (`,
        { amount: small.value },
        '). Whatever you decide about them, the outcome barely moves.',
      ],
    });
  }
  return findings;
}

export interface AttentionItem {
  symbol: string;
  name: string;
  verdict: AnalyzedHoldingDto['assessment']['verdict'];
  weightPct: number;
  /** The warnings behind the verdict, most severe first. */
  reasons: string[];
}

const severityRank = { Alert: 0, Warn: 1, Info: 2 } as const;

/** Positions worth a look: Watch or Review above 1%, then large Holds, biggest first. */
export function attentionItems(analysis: PortfolioAnalysisDto, limit = 6): AttentionItem[] {
  return analysis.holdings
    .filter(
      (row) =>
        row.assessment.material &&
        (isAttention(row) || row.assessment.verdict === 'HoldReviewSize'),
    )
    .map((row) => ({
      symbol: row.holding.symbol,
      name: row.holding.name,
      verdict: row.assessment.verdict,
      weightPct: row.assessment.weightPct,
      reasons: [...row.assessment.flags]
        .filter((flag) => flag.severity !== 'Info')
        .sort((a, b) => severityRank[a.severity] - severityRank[b.severity])
        .slice(0, 2)
        .map((flag) => flag.title),
    }))
    .sort((a, b) => b.weightPct - a.weightPct)
    .slice(0, limit);
}
