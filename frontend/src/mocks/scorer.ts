/**
 * A TypeScript port of the backend's HoldingScorer and PortfolioAnalyzer (backend/src/PortfolioSignals.Domain/Analysis),
 * used only by the demo API so that the fictional portfolio is internally consistent: every verdict, flag and KPI is
 * computed from the raw signals instead of being typed in by hand. The real app never scores anything on the client.
 */
import type {
  AnalystConsensus,
  AnalyzedHoldingDto,
  AssessmentFlag,
  FlagSeverity,
  HoldingAssessment,
  HoldingDto,
  PortfolioKpis,
  SignalData,
  Tier,
  Verdict,
} from '@/api/schema';

export const SMALL_POSITION_PCT = 1;
const MIN_PRICE_TARGETS = 3;
const MIN_ANALYSTS_FOR_BREADTH = 5;

type Consensus = NonNullable<AnalystConsensus>;

const consensusScale: Record<Consensus, number> = {
  StrongBuy: 1,
  Buy: 0.5,
  Neutral: 0,
  Sell: -0.5,
  StrongSell: -1,
};

const clip = (value: number) => Math.max(-1, Math.min(1, value));
const average = (values: number[]) => values.reduce((sum, v) => sum + v, 0) / values.length;
const roundTo = (value: number, decimals: number) => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function dayNumber(isoDate: string): number {
  return Math.floor(Date.parse(`${isoDate.slice(0, 10)}T00:00:00Z`) / 86_400_000);
}

function signed(value: number, decimals: number): string {
  const text = Math.abs(value).toFixed(decimals);
  return `${value < 0 ? '-' : '+'}${text}`;
}

function flag(key: string, severity: FlagSeverity, title: string, detail: string): AssessmentFlag {
  return { key, severity, title, detail };
}

export function tierOf(composite: number | null): Tier {
  if (composite === null) return 'NoData';
  if (composite >= 60) return 'Strong';
  if (composite >= 35) return 'Supported';
  if (composite >= 10) return 'Mixed';
  return 'Weak';
}

export function verdictOf(
  tier: Tier,
  flags: readonly AssessmentFlag[],
  weightPct: number,
): Verdict {
  const warnings = flags.filter((f) => f.severity === 'Warn' || f.severity === 'Alert').length;
  switch (tier) {
    case 'NoData':
      return 'NoData';
    case 'Strong':
      return weightPct >= 25 ? 'HoldReviewSize' : 'Hold';
    case 'Supported':
      return warnings >= 2 || flags.some((f) => f.key === 'priced_at_target') ? 'Watch' : 'Hold';
    case 'Mixed':
      return warnings >= 3 ? 'Review' : 'Watch';
    default:
      return 'Review';
  }
}

function noData(holding: HoldingDto, weightPct: number, material: boolean): HoldingAssessment {
  const flags: AssessmentFlag[] = [];
  if (holding.assetClass === 'Stock') {
    flags.push(
      flag(
        'not_synced',
        'Info',
        'No analyst data yet',
        'Connect TipRanks and run a sync to see analyst signals for this holding.',
      ),
    );
  } else if (holding.assetClass === 'Crypto') {
    flags.push(
      flag(
        'no_coverage',
        'Info',
        'No analyst coverage',
        'TipRanks publishes no ratings, Smart Score or AI score for crypto.',
      ),
    );
  } else {
    flags.push(
      flag('no_coverage', 'Info', 'Not covered by this analysis', 'Only single stocks are scored.'),
    );
  }
  if (holding.pnlPct <= -40) {
    flags.push(
      flag(
        'deep_loss',
        'Info',
        `Down ${Math.abs(holding.pnlPct).toFixed(0)}% vs your cost`,
        'Large in percent; check the amount before reading anything into it.',
      ),
    );
  }
  return {
    symbol: holding.symbol,
    tipRanksTicker: holding.tipRanksTicker,
    weightPct,
    material,
    components: {
      consensus: null,
      upside: null,
      smartScore: null,
      aiScore: null,
      technicals: null,
      breadth: null,
    },
    composite: null,
    tier: 'NoData',
    verdict: 'NoData',
    facts: {
      consensus: null,
      priceTarget: null,
      lastPrice: null,
      currency: null,
      streetUpsidePct: null,
      smartScore: null,
      aiScore: null,
      aiUpsidePct: null,
      nextEarningsDate: null,
      daysToEarnings: null,
      analystCount: null,
    },
    flags,
    viaTicker: null,
  };
}

export function assessHolding(
  holding: HoldingDto,
  weightPct: number,
  primary: SignalData | null,
  related: SignalData | null,
  relatedTicker: string | null,
  today: string,
): HoldingAssessment {
  const material = weightPct >= SMALL_POSITION_PCT;
  if (holding.assetClass !== 'Stock' || (primary === null && related === null)) {
    return noData(holding, weightPct, material);
  }

  const consensus = primary?.consensus ?? related?.consensus ?? null;
  const source = primary?.priceTarget != null ? primary : (related ?? primary);
  const priceTarget = source?.priceTarget ?? null;
  const lastPrice = source?.lastPrice ?? null;
  const breadth = primary?.breadth ?? related?.breadth ?? null;
  const via = !primary?.breadth && related?.breadth ? relatedTicker : null;
  const analysts = breadth?.analysts ?? 0;
  const withTargets = breadth?.withPriceTarget ?? 0;
  const ai = primary?.ai ?? null;
  const smartScore = primary?.smartScore ?? null;

  const targetsTrusted = breadth === null || withTargets >= MIN_PRICE_TARGETS;
  const upside =
    priceTarget != null && priceTarget > 0 && lastPrice != null && lastPrice > 0
      ? priceTarget / lastPrice - 1
      : null;
  const technicals = [primary?.technicalDay, primary?.technicalWeek]
    .filter((t): t is Consensus => t != null)
    .map((t) => consensusScale[t]);

  const components = {
    consensus: consensus ? consensusScale[consensus] : null,
    upside: upside !== null && targetsTrusted ? clip(upside / 0.3) : null,
    smartScore: smartScore != null && smartScore > 0 ? clip((smartScore - 5.5) / 4.5) : null,
    aiScore: ai?.score != null ? clip((ai.score - 60) / 25) : null,
    technicals: technicals.length > 0 ? average(technicals) : null,
    breadth:
      breadth && analysts >= MIN_ANALYSTS_FOR_BREADTH
        ? (breadth.buy - breadth.sell) / analysts
        : null,
  };

  const present = Object.values(components).filter((v): v is number => v !== null);
  const composite = present.length > 0 ? Math.round(average(present) * 100) : null;

  const nextEarnings = primary?.nextEarningsDate ?? related?.nextEarningsDate ?? null;
  const daysToEarnings = nextEarnings ? dayNumber(nextEarnings) - dayNumber(today) : null;

  const flags: AssessmentFlag[] = [];
  if (weightPct >= 25) {
    flags.push(
      flag(
        'concentration',
        'Alert',
        `${weightPct.toFixed(1)}% of the account in one stock`,
        'Single-name risk outweighs any analyst signal.',
      ),
    );
  } else if (weightPct >= 10) {
    flags.push(
      flag(
        'concentration',
        'Warn',
        `${weightPct.toFixed(1)}% of the account in one stock`,
        'A large single-name position.',
      ),
    );
  }
  if (upside !== null && upside < 0.03 && targetsTrusted) {
    flags.push(
      flag(
        'priced_at_target',
        'Warn',
        'Trades at its average analyst target',
        `Target ${priceTarget!.toFixed(2)} vs price ${lastPrice!.toFixed(2)} (${signed(upside * 100, 1)}%).`,
      ),
    );
  }
  if (
    upside !== null &&
    targetsTrusted &&
    ai?.upsidePct != null &&
    upside * 100 - ai.upsidePct >= 25
  ) {
    flags.push(
      flag(
        'dispersion',
        'Warn',
        'Street and AI targets disagree',
        `Street target implies ${signed(upside * 100, 0)}%, TipRanks' AI models ${signed(ai.upsidePct, 0)}%.`,
      ),
    );
  }
  if (consensus === 'Neutral' || consensus === 'Sell' || consensus === 'StrongSell') {
    flags.push(
      flag(
        'weak_consensus',
        'Warn',
        `Analyst consensus is ${consensus}`,
        'Analysts are not bullish on this name.',
      ),
    );
  }
  if (breadth && analysts < MIN_ANALYSTS_FOR_BREADTH) {
    flags.push(
      flag(
        'thin_coverage',
        'Warn',
        `Thin coverage: ${analysts} analyst${analysts === 1 ? '' : 's'} in 12 months`,
        'Consensus and targets rest on very few opinions.',
      ),
    );
  }
  if (technicals.length > 0 && average(technicals) < 0) {
    flags.push(
      flag(
        'weak_trend',
        'Warn',
        'Technical trend is negative',
        'Day and week summaries lean Sell.',
      ),
    );
  }
  if (daysToEarnings !== null && daysToEarnings >= 0 && daysToEarnings <= 30 && nextEarnings) {
    const date = new Date(`${nextEarnings.slice(0, 10)}T00:00:00Z`);
    flags.push(
      flag(
        'earnings_soon',
        'Info',
        `Earnings in ${daysToEarnings} days (${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()})`,
        'Event risk inside 30 days.',
      ),
    );
  }
  if (holding.pnlPct <= -40) {
    flags.push(
      flag(
        'deep_loss',
        composite !== null && composite < 35 ? 'Warn' : 'Info',
        `Down ${Math.abs(holding.pnlPct).toFixed(0)}% vs your cost`,
        'Weigh against how much you would rebuy today.',
      ),
    );
  }
  if (primary?.yearlyGainPct != null && primary.yearlyGainPct <= -25) {
    flags.push(
      flag(
        'year_decline',
        'Info',
        `Down ${Math.abs(primary.yearlyGainPct).toFixed(0)}% over 12 months`,
        'Price momentum has been weak.',
      ),
    );
  }

  const tier = tierOf(composite);
  return {
    symbol: holding.symbol,
    tipRanksTicker: holding.tipRanksTicker,
    weightPct,
    material,
    components,
    composite,
    tier,
    verdict: verdictOf(tier, flags, weightPct),
    facts: {
      consensus,
      priceTarget,
      lastPrice,
      currency: source?.currency ?? null,
      streetUpsidePct: upside === null ? null : roundTo(upside * 100, 1),
      smartScore,
      aiScore: ai?.score ?? null,
      aiUpsidePct: ai?.upsidePct ?? null,
      nextEarningsDate: nextEarnings,
      daysToEarnings,
      analystCount: breadth?.analysts ?? null,
    },
    flags,
    viaTicker: via,
  };
}

const VERDICTS: Verdict[] = ['Hold', 'HoldReviewSize', 'Watch', 'Review', 'NoData'];

function share(part: number, total: number): number {
  return total > 0 ? roundTo((part / total) * 100, 1) : 0;
}

function weightedAverage(
  rows: AnalyzedHoldingDto[],
  pick: (row: AnalyzedHoldingDto) => number | null,
): number | null {
  const points = rows
    .map((row) => ({ weight: row.holding.value, value: pick(row) }))
    .filter((p): p is { weight: number; value: number } => p.value !== null && p.weight > 0);
  const weight = points.reduce((sum, p) => sum + p.weight, 0);
  return weight > 0
    ? roundTo(points.reduce((sum, p) => sum + p.weight * p.value, 0) / weight, 2)
    : null;
}

export function buildKpis(
  rows: AnalyzedHoldingDto[],
  account: { totalValue: number; unrealizedPnl: number },
): PortfolioKpis {
  const total = account.totalValue;
  const directValue = rows.reduce((sum, r) => sum + r.holding.value, 0);
  const values = rows.map((r) => r.holding.value).sort((a, b) => b - a);
  const hhi = directValue > 0 ? values.reduce((sum, v) => sum + (v / directValue) ** 2, 0) : 0;
  const stocks = rows.filter((r) => r.holding.assetClass === 'Stock');
  const within30 = stocks.filter((r) => {
    const days = r.assessment.facts.daysToEarnings;
    return days !== null && days >= 0 && days <= 30;
  });
  const small = rows.filter((r) => !r.assessment.material);

  return {
    totalValue: total,
    directValue,
    unrealizedPnl: account.unrealizedPnl,
    positions: rows.length,
    top1Pct: share(
      values.slice(0, 1).reduce((s, v) => s + v, 0),
      total,
    ),
    top5Pct: share(
      values.slice(0, 5).reduce((s, v) => s + v, 0),
      total,
    ),
    effectivePositions: hhi > 0 ? roundTo(1 / hhi, 1) : 0,
    weightedSmartScore: weightedAverage(stocks, (r) => r.assessment.facts.smartScore),
    weightedStreetUpsidePct: weightedAverage(stocks, (r) =>
      r.assessment.components.upside === null ? null : r.assessment.facts.streetUpsidePct,
    ),
    earnings30DaysPct: share(
      within30.reduce((s, r) => s + r.holding.value, 0),
      total,
    ),
    earnings30DaysSymbols: within30.map((r) => r.holding.symbol),
    smallPositions: {
      count: small.length,
      value: small.reduce((s, r) => s + r.holding.value, 0),
      pct: share(
        small.reduce((s, r) => s + r.holding.value, 0),
        total,
      ),
    },
    verdictCounts: Object.fromEntries(
      VERDICTS.map((v) => [v, rows.filter((r) => r.assessment.verdict === v).length]),
    ),
  };
}
