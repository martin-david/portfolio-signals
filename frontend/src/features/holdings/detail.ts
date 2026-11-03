import type { AnalyzedHoldingDto, AssessmentFacts, SignalData } from '@/api/schema';
import { consensusLabel } from '@/features/portfolio/verdicts';
import {
  formatDate,
  formatMoney,
  formatNumber,
  formatPercent,
  formatSignedPercent,
  plural,
} from '@/lib/format';

/** A label and a reading, for the definition lists of a holding's page. */
export interface Fact {
  label: string;
  value: string;
}

/** A market price in the instrument's own currency, to the cent. Prices are not the user's amounts and are not hidden. */
function price(value: number | null | undefined, currency: string | null | undefined): string {
  if (value === null || value === undefined) {
    return '\u2013';
  }
  return currency ? formatMoney(value, currency, 2) : formatNumber(value, 2);
}

/** What the analysts say: consensus, how many rated, and where the price targets lie. */
export function analystFacts(row: AnalyzedHoldingDto, signals: SignalData | null): Fact[] {
  const { facts, viaTicker } = row.assessment;
  const breadth = signals?.breadth ?? null;
  const out: Fact[] = [{ label: 'Consensus', value: consensusLabel(facts.consensus) }];

  if (signals?.bestAnalystConsensus) {
    out.push({
      label: 'Best-ranked analysts',
      value: consensusLabel(signals.bestAnalystConsensus),
    });
  }
  if (breadth) {
    out.push({
      label: 'Ratings',
      value: `${breadth.buy} Buy \u00b7 ${breadth.hold} Hold \u00b7 ${breadth.sell} Sell, ${breadth.analysts} ${plural(breadth.analysts, 'analyst')} in the last 12 months`,
    });
  } else if (facts.analystCount !== null) {
    out.push({ label: 'Analysts', value: `${facts.analystCount} in the last 12 months` });
  }

  if (facts.priceTarget === null) {
    out.push({ label: 'Average price target', value: 'None: too few analysts have set one.' });
  } else {
    const upside =
      facts.streetUpsidePct === null
        ? ''
        : ` (${formatSignedPercent(facts.streetUpsidePct)} from the ${price(facts.lastPrice, facts.currency)} price)`;
    out.push({
      label: 'Average price target',
      value: `${price(facts.priceTarget, facts.currency)}${upside}`,
    });
  }
  if (breadth && breadth.priceTargetMedian !== null) {
    out.push({
      label: 'Target range',
      value: `${price(breadth.priceTargetMin, facts.currency)} to ${price(breadth.priceTargetMax, facts.currency)}, median ${price(breadth.priceTargetMedian, facts.currency)}`,
    });
  }
  if (viaTicker) {
    out.push({
      label: 'Covered as',
      value: `${viaTicker}. TipRanks covers that listing, not this one.`,
    });
  }
  return out;
}

/** The AI models' score, rating and target. Empty when TipRanks has no AI analysis for the holding. */
export function aiFacts(row: AnalyzedHoldingDto, signals: SignalData | null): Fact[] {
  const { facts } = row.assessment;
  const ai = signals?.ai ?? null;
  const score = ai?.score ?? facts.aiScore;
  if (score === null || score === undefined) {
    return [];
  }
  const upside = ai?.upsidePct ?? facts.aiUpsidePct;
  const out: Fact[] = [
    { label: 'AI score', value: `${formatNumber(score)}/100${ai?.rating ? `, ${ai.rating}` : ''}` },
  ];
  if (ai?.priceTarget !== null && ai?.priceTarget !== undefined) {
    out.push({
      label: 'AI price target',
      value: `${price(ai.priceTarget, facts.currency)}${upside === null || upside === undefined ? '' : ` (${formatSignedPercent(upside)})`}`,
    });
  } else if (upside !== null && upside !== undefined) {
    out.push({ label: 'AI upside', value: formatSignedPercent(upside) });
  }
  if (ai?.asOf) {
    out.push({ label: 'As of', value: formatDate(ai.asOf) });
  }
  return out;
}

/** The technical trend on the day and week charts. */
export function technicalFacts(signals: SignalData | null): Fact[] {
  const out: Fact[] = [];
  if (signals?.technicalDay) {
    out.push({ label: 'Day', value: consensusLabel(signals.technicalDay) });
  }
  if (signals?.technicalWeek) {
    out.push({ label: 'Week', value: consensusLabel(signals.technicalWeek) });
  }
  return out;
}

/** Price and momentum: where the stock stands and how it has moved. Only what TipRanks reported is listed. */
export function momentumFacts(signals: SignalData | null, facts: AssessmentFacts): Fact[] {
  const out: Fact[] = [];
  if (facts.lastPrice !== null) {
    out.push({ label: 'Last price', value: price(facts.lastPrice, facts.currency) });
  }
  if (signals?.ytdGainPct != null) {
    out.push({ label: 'Year to date', value: formatSignedPercent(signals.ytdGainPct) });
  }
  if (signals?.yearlyGainPct != null) {
    out.push({ label: 'Past year', value: formatSignedPercent(signals.yearlyGainPct) });
  }
  if (signals?.peRatio != null) {
    out.push({ label: 'Price/earnings', value: formatNumber(signals.peRatio, 1) });
  }
  if (signals?.dividendYieldPct != null) {
    out.push({ label: 'Dividend yield', value: formatPercent(signals.dividendYieldPct, 2) });
  }
  return out;
}

/** The next earnings report, with how far away it is. */
export function earningsFact(facts: AssessmentFacts): Fact | null {
  if (!facts.nextEarningsDate) {
    return null;
  }
  const date = formatDate(facts.nextEarningsDate);
  const days = facts.daysToEarnings;
  let when = date;
  if (days !== null) {
    if (days === 0) {
      when = `${date}, today`;
    } else if (days === 1) {
      when = `${date}, tomorrow`;
    } else if (days > 1) {
      when = `${date}, in ${days} days`;
    }
  }
  return { label: 'Next earnings', value: when };
}

/** Where the analysis ends and the person's own judgement starts. Generated from the weight, never written per holding. */
export function cannotSee(row: AnalyzedHoldingDto): string[] {
  const { weightPct } = row.assessment;
  return [
    `How much one position may move your net worth. This one is ${formatPercent(weightPct)} of the account, so a 10% move in it is about ${formatPercent(weightPct / 10)} of the account.`,
    'Why you hold it, how long you plan to keep it, and what selling would cost you in tax.',
    'What else you own outside this account.',
  ];
}
