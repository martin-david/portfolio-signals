import type { AnalyzedHoldingDto } from '@/api/schema';
import { formatNumber, formatSignedPercent } from '@/lib/format';
import type { RangeTone } from '@/ui/RangeBar';

import { consensusLabel } from './verdicts';

export type SignalKey = 'smartScore' | 'consensus' | 'upside' | 'ai' | 'trend' | 'breadth';

export interface SignalCell {
  key: SignalKey;
  /** Column heading. */
  heading: string;
  present: boolean;
  /** Where the reading sits on its scale (null when there is none). */
  value: number | null;
  min: number;
  max: number;
  /** The supportive stretch, shaded. */
  zone: readonly [number, number];
  ticks: readonly number[];
  /** Draws the reference line at this value. */
  zero?: number;
  tone: RangeTone;
  /** The reading in words and numbers. */
  text: string;
  /** What assistive technology says for the bar. */
  spoken: string;
  /** Shown instead of the bar when the signal is missing, and why. */
  missing: string;
}

/** Clearly supportive readings turn the marker teal, clearly adverse ones crimson, as in the prototype. */
export function toneOf(component: number | null | undefined): RangeTone {
  if (component === null || component === undefined) {
    return 'neutral';
  }
  if (component >= 0.35) {
    return 'good';
  }
  return component <= -0.15 ? 'bad' : 'neutral';
}

function trendWord(component: number): string {
  if (component >= 0.75) return 'Strong Buy';
  if (component >= 0.25) return 'Buy';
  if (component > -0.25) return 'Neutral';
  return component > -0.75 ? 'Sell' : 'Strong Sell';
}

/** The six signals of a holding as range-bar cells, in the order of the report's columns. */
export function signalCells(row: AnalyzedHoldingDto): SignalCell[] {
  const { components, facts } = row.assessment;
  const analysts = facts.analystCount;

  const smartScore: SignalCell = {
    key: 'smartScore',
    heading: 'Smart Score',
    present: facts.smartScore !== null,
    value: facts.smartScore,
    min: 1,
    max: 10,
    zone: [8, 10],
    ticks: [5.5],
    tone: toneOf(components.smartScore),
    text: facts.smartScore === null ? '' : `${facts.smartScore}/10`,
    spoken: `Smart Score ${facts.smartScore} of 10`,
    missing: 'no score',
  };

  const consensus: SignalCell = {
    key: 'consensus',
    heading: 'Consensus',
    present: components.consensus !== null,
    value: components.consensus,
    min: -1,
    max: 1,
    zone: [0.5, 1],
    ticks: [-1, -0.5, 0, 0.5, 1],
    tone: toneOf(components.consensus),
    text: consensusLabel(facts.consensus),
    spoken: `Analyst consensus ${consensusLabel(facts.consensus)}`,
    missing: 'no consensus',
  };

  const hasUpside = components.upside !== null && facts.streetUpsidePct !== null;
  const upside: SignalCell = {
    key: 'upside',
    heading: 'Target upside',
    present: hasUpside,
    value: facts.streetUpsidePct,
    min: -20,
    max: 60,
    zone: [10, 60],
    ticks: [],
    zero: 0,
    tone: toneOf(components.upside),
    text: formatSignedPercent(facts.streetUpsidePct),
    spoken: `Target upside ${formatSignedPercent(facts.streetUpsidePct)}`.replace('%', ' percent'),
    missing: facts.priceTarget === null ? 'no price target' : 'few targets',
  };

  const ai: SignalCell = {
    key: 'ai',
    heading: 'AI models',
    present: facts.aiScore !== null,
    value: facts.aiScore,
    min: 30,
    max: 100,
    zone: [65, 100],
    ticks: [60],
    tone: toneOf(components.aiScore),
    text: facts.aiScore === null ? '' : `${formatNumber(facts.aiScore)}/100`,
    spoken: `AI score ${formatNumber(facts.aiScore)} of 100`,
    missing: 'no AI score',
  };

  const trend: SignalCell = {
    key: 'trend',
    heading: 'Trend',
    present: components.technicals !== null,
    value: components.technicals,
    min: -1,
    max: 1,
    zone: [0.25, 1],
    ticks: [],
    zero: 0,
    tone: toneOf(components.technicals),
    text: components.technicals === null ? '' : trendWord(components.technicals),
    spoken: `Technical trend ${components.technicals === null ? 'not available' : trendWord(components.technicals)}`,
    missing: 'n/a',
  };

  const breadth: SignalCell = {
    key: 'breadth',
    heading: 'Analyst breadth',
    present: components.breadth !== null,
    value: components.breadth,
    min: -1,
    max: 1,
    zone: [0.5, 1],
    ticks: [],
    zero: 0,
    tone: toneOf(components.breadth),
    text: analysts === null ? '' : `${analysts} analysts`,
    spoken: `Analyst breadth over ${analysts} analysts`,
    missing:
      analysts === null ? 'no analysts' : `${analysts} ${analysts === 1 ? 'analyst' : 'analysts'}`,
  };

  return [smartScore, consensus, upside, ai, trend, breadth];
}

/** Plain-language signals for narrow screens, where the bars give way to text. */
export function signalLines(row: AnalyzedHoldingDto): string[] {
  return signalCells(row)
    .filter((cell) => cell.present)
    .map((cell) => `${cell.heading} ${cell.text}`);
}

/** Why a holding has no signals at all (crypto, funds, or nothing synced yet), from the backend's own flags. */
export function noSignalsReason(row: AnalyzedHoldingDto): string | null {
  const flag = row.assessment.flags.find((f) => f.key === 'no_coverage' || f.key === 'not_synced');
  return flag ? flag.detail : null;
}
