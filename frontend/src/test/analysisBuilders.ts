import type {
  AnalyzedHoldingDto,
  HoldingAssessment,
  HoldingDto,
  PortfolioAnalysisDto,
  PortfolioKpis,
  Verdict,
} from '@/api/schema';

interface RowOptions {
  symbol: string;
  verdict?: Verdict;
  weightPct?: number;
  value?: number;
  material?: boolean;
  assetClass?: HoldingDto['assetClass'];
  pnlPct?: number;
  composite?: number | null;
  assessment?: Partial<HoldingAssessment>;
}

/** A minimal analysed holding for tests that only care about a few fields. */
export function makeRow(options: RowOptions): AnalyzedHoldingDto {
  const weightPct = options.weightPct ?? 5;
  const value = options.value ?? weightPct * 1000;
  return {
    holding: {
      instrumentId: 1,
      symbol: options.symbol,
      name: `${options.symbol} Inc`,
      assetClass: options.assetClass ?? 'Stock',
      tipRanksTicker: options.symbol,
      invested: value,
      value,
      weightPct,
      pnl: 0,
      pnlPct: options.pnlPct ?? 0,
      units: 1,
      avgOpenRate: 1,
      avgLeverage: 1,
    },
    assessment: {
      symbol: options.symbol,
      tipRanksTicker: options.symbol,
      weightPct,
      material: options.material ?? weightPct >= 1,
      components: {
        consensus: null,
        upside: null,
        smartScore: null,
        aiScore: null,
        technicals: null,
        breadth: null,
      },
      composite: options.composite ?? null,
      tier: 'Supported',
      verdict: options.verdict ?? 'Hold',
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
      flags: [],
      viaTicker: null,
      ...options.assessment,
    },
  };
}

export function makeKpis(overrides: Partial<PortfolioKpis> = {}): PortfolioKpis {
  return {
    totalValue: 100_000,
    directValue: 90_000,
    unrealizedPnl: 5_000,
    positions: 5,
    top1Pct: 30,
    top5Pct: 80,
    effectivePositions: 3.4,
    weightedSmartScore: 7.8,
    weightedStreetUpsidePct: 9.4,
    earnings30DaysPct: 0,
    earnings30DaysSymbols: [],
    smallPositions: { count: 0, value: 0, pct: 0 },
    verdictCounts: { Hold: 0, HoldReviewSize: 0, Watch: 0, Review: 0, NoData: 0 },
    ...overrides,
  };
}

export function makeAnalysis(
  rows: AnalyzedHoldingDto[],
  kpis: Partial<PortfolioKpis> = {},
): PortfolioAnalysisDto {
  return {
    snapshotId: '20261021T100000Z',
    asOf: '2026-10-21T10:00:00Z',
    signalsFetchedAt: '2026-10-21T09:55:00Z',
    kpis: makeKpis(kpis),
    holdings: rows,
    disclaimer: 'Informational only, not investment advice.',
  };
}
