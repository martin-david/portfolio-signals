import type { AnalystConsensus, FlagSeverity, Tier, Verdict } from '@/api/schema';
import type { StatusTone } from '@/ui/StatusLabel';
import type { VerdictKey } from '@/ui/tokens';

export type ChipKind = 'hold' | 'watch' | 'review' | 'nodata';

export interface VerdictMeta {
  verdict: Verdict;
  /** Colour family of the chip. */
  chip: ChipKind;
  /** Colour family of the segment in the account strip. */
  strip: VerdictKey;
  /** The word on the chip. */
  label: string;
  /** The full name, for legends and assistive technology. */
  name: string;
  /** Position in the holdings panel when sorted by verdict. */
  order: number;
}

/**
 * Review means "look again", not "sell". A verdict is informational and never advice (see the Method page).
 * The order and labels follow the prototype's report.
 */
export const verdictMeta: Record<Verdict, VerdictMeta> = {
  HoldReviewSize: {
    verdict: 'HoldReviewSize',
    chip: 'hold',
    strip: 'size',
    label: 'HOLD \u00b7 SIZE',
    name: 'Hold, review size',
    order: 0,
  },
  Hold: { verdict: 'Hold', chip: 'hold', strip: 'hold', label: 'HOLD', name: 'Hold', order: 1 },
  Watch: {
    verdict: 'Watch',
    chip: 'watch',
    strip: 'watch',
    label: 'WATCH',
    name: 'Watch',
    order: 2,
  },
  Review: {
    verdict: 'Review',
    chip: 'review',
    strip: 'review',
    label: 'REVIEW',
    name: 'Review',
    order: 3,
  },
  NoData: {
    verdict: 'NoData',
    chip: 'nodata',
    strip: 'nodata',
    label: 'NO DATA',
    name: 'No data',
    order: 4,
  },
};

export const verdictOrder: readonly Verdict[] = (Object.keys(verdictMeta) as Verdict[]).sort(
  (a, b) => verdictMeta[a].order - verdictMeta[b].order,
);

const consensusLabels: Record<NonNullable<AnalystConsensus>, string> = {
  StrongBuy: 'Strong Buy',
  Buy: 'Buy',
  Neutral: 'Neutral',
  Sell: 'Sell',
  StrongSell: 'Strong Sell',
};

const consensusShortLabels: Record<NonNullable<AnalystConsensus>, string> = {
  StrongBuy: 'SB',
  Buy: 'B',
  Neutral: 'N',
  Sell: 'S',
  StrongSell: 'SS',
};

export function consensusLabel(consensus: AnalystConsensus | null | undefined): string {
  return consensus ? consensusLabels[consensus] : 'No consensus';
}

export function consensusShort(consensus: AnalystConsensus | null | undefined): string {
  return consensus ? consensusShortLabels[consensus] : '\u2013';
}

const tierLabels: Record<Tier, string> = {
  Strong: 'Strong',
  Supported: 'Supported',
  Mixed: 'Mixed',
  Weak: 'Weak',
  NoData: 'No data',
};

export function tierLabel(tier: Tier): string {
  return tierLabels[tier];
}

export interface SeverityMeta {
  label: string;
  tone: StatusTone;
  icon: string;
  /** Position when flags are listed, most serious first. */
  rank: number;
}

export const severityMeta: Record<FlagSeverity, SeverityMeta> = {
  Alert: { label: 'Alert', tone: 'danger', icon: 'alert-circle-outline', rank: 0 },
  Warn: { label: 'Warning', tone: 'warning', icon: 'alert-outline', rank: 1 },
  Info: { label: 'Info', tone: 'neutral', icon: 'information-outline', rank: 2 },
};

export function severityLabel(severity: FlagSeverity): string {
  return severityMeta[severity].label;
}
