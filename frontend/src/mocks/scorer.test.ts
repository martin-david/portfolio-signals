import type { HoldingDto, SignalData } from '@/api/schema';

import { assessHolding, buildKpis, tierOf, verdictOf } from './scorer';

const TODAY = '2026-10-10';

function holding(overrides: Partial<HoldingDto> = {}): HoldingDto {
  const value = overrides.value ?? 5000;
  return {
    instrumentId: 1,
    symbol: 'MSFT',
    name: 'MSFT',
    assetClass: 'Stock',
    tipRanksTicker: overrides.symbol ?? 'MSFT',
    invested: value * 0.8,
    value,
    weightPct: 0,
    pnl: value * 0.2,
    pnlPct: 25,
    units: 10,
    avgOpenRate: 100,
    avgLeverage: 1,
    ...overrides,
  };
}

function strongSignals(overrides: Partial<SignalData> = {}): SignalData {
  return {
    companyName: 'Microsoft',
    consensus: 'StrongBuy',
    priceTarget: 500,
    lastPrice: 420,
    smartScore: 9,
    ai: { score: 85, rating: 'outperform', priceTarget: 510, upsidePct: 21, asOf: '2026-09-30' },
    nextEarningsDate: '2026-10-20',
    ...overrides,
  };
}

const assess = (
  h: HoldingDto,
  weight: number,
  primary: SignalData | null,
  related: SignalData | null = null,
  relatedTicker: string | null = null,
) => assessHolding(h, weight, primary, related, relatedTicker, TODAY);

// These cases mirror backend/tests/PortfolioSignals.Domain.Tests/PortfolioAndScoringTests.cs.
describe('assessHolding (port of HoldingScorer)', () => {
  it('gives strong signals a strong tier and a hold verdict', () => {
    const result = assess(holding(), 5, strongSignals());

    expect(result.tier).toBe('Strong');
    expect(result.verdict).toBe('Hold');
    expect(result.composite).toBeGreaterThanOrEqual(60);
    expect(result.facts.streetUpsidePct).toBeCloseTo(19.0, 1);
  });

  it('skips missing signals instead of scoring them as zero', () => {
    const result = assess(holding(), 5, { consensus: 'StrongBuy' });

    expect(result.composite).toBe(100);
    expect(result.components.upside).toBeNull();
    expect(result.components.smartScore).toBeNull();
  });

  it('flags a large strong position to review its size', () => {
    const result = assess(holding({ value: 30000 }), 30, strongSignals());

    expect(result.verdict).toBe('HoldReviewSize');
    expect(result.flags).toContainEqual(
      expect.objectContaining({ key: 'concentration', severity: 'Alert' }),
    );
  });

  it('downgrades a supported stock trading at its target to watch', () => {
    const result = assess(holding(), 5, {
      consensus: 'StrongBuy',
      priceTarget: 420,
      lastPrice: 420,
      smartScore: 8,
      ai: { score: 60, rating: 'neutral', priceTarget: 420, upsidePct: 0, asOf: null },
    });

    expect(result.tier).toBe('Supported');
    expect(result.flags.map((f) => f.key)).toContain('priced_at_target');
    expect(result.verdict).toBe('Watch');
  });

  it('keeps the flag but stays a hold for a strong stock at its target', () => {
    const result = assess(holding(), 5, strongSignals({ priceTarget: 421 }));

    expect(result.flags.map((f) => f.key)).toContain('priced_at_target');
    expect(result.verdict).toBe('Hold');
  });

  it('gives weak signals a review verdict', () => {
    const result = assess(holding({ pnlPct: -50 }), 5, {
      consensus: 'StrongSell',
      smartScore: 2,
      priceTarget: 80,
      lastPrice: 100,
      ai: { score: 30, rating: 'underperform', priceTarget: 70, upsidePct: -30, asOf: null },
    });

    expect(result.tier).toBe('Weak');
    expect(result.verdict).toBe('Review');
    expect(result.flags.map((f) => f.key)).toEqual(
      expect.arrayContaining(['weak_consensus', 'deep_loss']),
    );
  });

  it('has no data for crypto and says why', () => {
    const result = assess(holding({ symbol: 'LTC', assetClass: 'Crypto' }), 0.5, null);

    expect(result.verdict).toBe('NoData');
    expect(result.tier).toBe('NoData');
    expect(result.flags.map((f) => f.key)).toEqual(['no_coverage']);
  });

  it('asks for a sync when a stock has no signals yet', () => {
    const result = assess(holding(), 5, null);

    expect(result.verdict).toBe('NoData');
    expect(result.flags.map((f) => f.key)).toEqual(['not_synced']);
  });

  it('lets a sibling listing stand in when the primary ticker has no coverage', () => {
    const result = assess(
      holding({ symbol: 'ATROB' }),
      5,
      {},
      { consensus: 'Buy', priceTarget: 30, lastPrice: 25 },
      'ATRO',
    );

    expect(result.facts.consensus).toBe('Buy');
    expect(result.facts.priceTarget).toBe(30);
  });

  it('flags thin coverage only when the ratings breakdown is known', () => {
    const thin = strongSignals({
      breadth: {
        analysts: 3,
        buy: 3,
        hold: 0,
        sell: 0,
        withPriceTarget: 3,
        priceTargetMin: 450,
        priceTargetMedian: 500,
        priceTargetMax: 550,
      },
    });

    expect(assess(holding(), 5, strongSignals()).flags.map((f) => f.key)).not.toContain(
      'thin_coverage',
    );
    expect(assess(holding(), 5, thin).flags.map((f) => f.key)).toContain('thin_coverage');
  });

  it('flags earnings inside thirty days', () => {
    const result = assess(holding(), 5, strongSignals());

    expect(result.facts.daysToEarnings).toBe(10);
    expect(result.flags).toContainEqual(
      expect.objectContaining({ key: 'earnings_soon', title: 'Earnings in 10 days (Oct 20)' }),
    );
  });

  it('records the sibling a result was read through', () => {
    const result = assess(
      holding({ symbol: 'ALPSB' }),
      4,
      {},
      {
        consensus: 'StrongBuy',
        breadth: {
          analysts: 9,
          buy: 7,
          hold: 2,
          sell: 0,
          withPriceTarget: 8,
          priceTargetMin: 1,
          priceTargetMedian: 2,
          priceTargetMax: 3,
        },
      },
      'ALPS',
    );

    expect(result.viaTicker).toBe('ALPS');
  });

  it.each([
    [60, 'Strong'],
    [59, 'Supported'],
    [35, 'Supported'],
    [34, 'Mixed'],
    [10, 'Mixed'],
    [9, 'Weak'],
    [-40, 'Weak'],
  ])('puts a composite of %i in the %s tier', (composite, tier) => {
    expect(tierOf(composite)).toBe(tier);
  });

  it('decides the verdict from tier, warnings and weight', () => {
    const warn = (key: string) => ({ key, severity: 'Warn' as const, title: key, detail: '' });
    expect(verdictOf('Mixed', [warn('a'), warn('b')], 5)).toBe('Watch');
    expect(verdictOf('Mixed', [warn('a'), warn('b'), warn('c')], 5)).toBe('Review');
    expect(verdictOf('Supported', [warn('a'), warn('b')], 5)).toBe('Watch');
    expect(verdictOf('Supported', [warn('a')], 5)).toBe('Hold');
    expect(verdictOf('Strong', [], 25)).toBe('HoldReviewSize');
    expect(verdictOf('NoData', [], 5)).toBe('NoData');
  });
});

describe('buildKpis (port of PortfolioAnalyzer)', () => {
  it('computes the portfolio KPIs from the scored holdings', () => {
    const rows = [
      {
        h: holding({ symbol: 'MSFT', value: 5000 }),
        signals: strongSignals() as SignalData | null,
      },
      { h: holding({ symbol: 'NVDA', value: 3000 }), signals: null },
      { h: holding({ symbol: 'LTC', assetClass: 'Crypto', value: 50 }), signals: null },
    ].map(({ h, signals }) => ({
      holding: h,
      assessment: assess(h, (h.value / 10000) * 100, signals),
    }));

    const kpis = buildKpis(rows, { totalValue: 10000, unrealizedPnl: 0 });

    expect(kpis.positions).toBe(3);
    expect(kpis.top1Pct).toBe(50);
    expect(kpis.verdictCounts.HoldReviewSize).toBe(1);
    expect(kpis.verdictCounts.NoData).toBe(2);
    expect(kpis.smallPositions.count).toBe(1);
    expect(kpis.earnings30DaysSymbols).toEqual(['MSFT']);
    expect(kpis.effectivePositions).toBeGreaterThanOrEqual(1);
    expect(kpis.effectivePositions).toBeLessThanOrEqual(3);
    expect(Object.keys(kpis.verdictCounts).sort()).toEqual([
      'Hold',
      'HoldReviewSize',
      'NoData',
      'Review',
      'Watch',
    ]);
  });
});
