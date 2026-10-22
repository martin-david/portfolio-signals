import type {
  AnalystConsensus,
  AssessmentFlag,
  FlagSeverity,
  HoldingAssessment,
  HoldingDto,
  SignalData,
  Tier,
  Verdict,
} from '@/api/schema';
import { assessHolding, tierOf, verdictOf } from '@/mocks/scorer';

import {
  BIG_POSITION_PCT,
  FLAG_RULES,
  LARGE_POSITION_PCT,
  MATERIAL_NOTE,
  MATERIAL_PCT,
  SIGNAL_RULES,
  TIER_RULES,
} from './content';

// The Method page restates the scorer's rules in words. These tests run the scorer the demo uses at the edges of every
// rule the page states, so a rule that changes there cannot leave the page saying something else. The backend's own
// tests hold that scorer to HoldingScorer.cs (see mocks/scorer.test.ts).

const TODAY = '2026-10-10';
const MINUS = '\u2212';

function holding(overrides: Partial<HoldingDto> = {}): HoldingDto {
  return {
    instrumentId: 1,
    symbol: 'MSFT',
    name: 'Microsoft',
    assetClass: 'Stock',
    tipRanksTicker: 'MSFT',
    invested: 4000,
    value: 5000,
    weightPct: 0,
    pnl: 1000,
    pnlPct: 25,
    units: 10,
    avgOpenRate: 100,
    avgLeverage: 1,
    ...overrides,
  };
}

function breadth(analysts: number, buy = analysts, sell = 0, withPriceTarget = analysts) {
  return {
    analysts,
    buy,
    hold: analysts - buy - sell,
    sell,
    withPriceTarget,
    priceTargetMin: null,
    priceTargetMedian: null,
    priceTargetMax: null,
  };
}

/** A stock with healthy signals and no flag, to change one thing at a time. */
function calm(overrides: Partial<SignalData> = {}): SignalData {
  return {
    consensus: 'StrongBuy',
    priceTarget: 500,
    lastPrice: 420,
    smartScore: 9,
    ai: { score: 85, rating: 'outperform', priceTarget: 510, upsidePct: 21, asOf: '2026-09-30' },
    technicalDay: 'Buy',
    technicalWeek: 'Buy',
    breadth: breadth(12, 9, 1),
    nextEarningsDate: '2026-12-01',
    ...overrides,
  };
}

/** Signals weak enough for the weakest tier. */
function weak(): SignalData {
  return {
    consensus: 'StrongSell',
    smartScore: 2,
    priceTarget: 80,
    lastPrice: 100,
    ai: { score: 30, rating: 'underperform', priceTarget: 70, upsidePct: -30, asOf: null },
  };
}

function assess(
  signals: SignalData | null,
  options: { weight?: number; holding?: Partial<HoldingDto> } = {},
): HoldingAssessment {
  return assessHolding(holding(options.holding), options.weight ?? 5, signals, null, null, TODAY);
}

function flag(key: string, severity: FlagSeverity = 'Warn'): AssessmentFlag {
  return { key, severity, title: key, detail: '' };
}

function warnings(count: number, extra: AssessmentFlag[] = []): AssessmentFlag[] {
  return [...Array.from({ length: count }, (_, index) => flag(`warning-${index}`)), ...extra];
}

function sign(value: number): string {
  if (value === 0) return '0';
  return `${value < 0 ? MINUS : '+'}${Math.abs(value)}`;
}

describe('the six signals', () => {
  const rule = (name: string) => SIGNAL_RULES.find((signal) => signal.name === name)!;

  it('are the six the scorer averages', () => {
    const components = Object.keys(assess(calm()).components);

    expect(components).toHaveLength(6);
    expect(SIGNAL_RULES).toHaveLength(components.length);
  });

  const consensus: [AnalystConsensus, string, number][] = [
    ['StrongSell', 'Strong Sell', -1],
    ['Sell', 'Sell', -0.5],
    ['Neutral', 'Neutral', 0],
    ['Buy', 'Buy', 0.5],
    ['StrongBuy', 'Strong Buy', 1],
  ];

  it.each(consensus)('scores a %s consensus as the page says', (key, name, value) => {
    expect(assess({ consensus: key }).components.consensus).toBe(value);
    expect(rule('Consensus').scale).toContain(`${name} ${sign(value)}`);
  });

  it('divides the upside by 30% and limits it to the scale', () => {
    const upside = (target: number) =>
      assess(calm({ priceTarget: target, lastPrice: 100, breadth: breadth(12) })).components.upside;

    expect(upside(115)).toBeCloseTo(0.5);
    expect(upside(160)).toBe(1);
    expect(upside(40)).toBe(-1);
    expect(rule('Target upside').scale).toContain('divided by 30%');
  });

  it('leaves the upside out when fewer than 3 analysts have set a target', () => {
    const upside = (withTargets: number) =>
      assess(calm({ breadth: breadth(12, 9, 1, withTargets) })).components.upside;

    expect(upside(2)).toBeNull();
    expect(upside(3)).not.toBeNull();
    expect(rule('Target upside').scale).toContain('fewer than 3 analysts');
  });

  it('puts the Smart Score on the scale as (score \u2212 5.5) \u00f7 4.5', () => {
    const score = (value: number) => assess(calm({ smartScore: value })).components.smartScore;

    expect(score(10)).toBe(1);
    expect(score(5.5)).toBe(0);
    expect(score(1)).toBe(-1);
    expect(rule('Smart Score').scale).toContain('(score \u2212 5.5) \u00f7 4.5');
  });

  it('puts the AI score on the scale as (score \u2212 60) \u00f7 25, limited to the scale', () => {
    const score = (value: number) =>
      assess(
        calm({
          ai: { score: value, rating: null, priceTarget: null, upsidePct: null, asOf: null },
        }),
      ).components.aiScore;

    expect(score(85)).toBe(1);
    expect(score(60)).toBe(0);
    expect(score(72.5)).toBeCloseTo(0.5);
    expect(score(10)).toBe(-1);
    expect(rule('AI models').scale).toContain('(score \u2212 60) \u00f7 25');
  });

  it('averages the day and the week for the technical trend', () => {
    const trend = (day: AnalystConsensus, week: AnalystConsensus) =>
      assess(calm({ technicalDay: day, technicalWeek: week })).components.technicals;

    expect(trend('StrongBuy', 'StrongSell')).toBe(0);
    expect(trend('StrongBuy', 'Buy')).toBe(0.75);
    expect(rule('Technical trend').scale).toContain('average of the two');
  });

  it('measures breadth as (Buy \u2212 Sell) \u00f7 analysts and leaves it out below 5 analysts', () => {
    const measure = (analysts: number, buy: number, sell: number) =>
      assess(calm({ breadth: breadth(analysts, buy, sell) })).components.breadth;

    expect(measure(10, 7, 2)).toBeCloseTo(0.5);
    expect(measure(5, 5, 0)).toBe(1);
    expect(measure(4, 4, 0)).toBeNull();
    expect(rule('Analyst breadth').scale).toContain('(Buy \u2212 Sell) \u00f7 analysts');
    expect(rule('Analyst breadth').scale).toContain('fewer than 5 analysts');
  });

  it('are averaged as they exist, times 100, and never counted as zero', () => {
    expect(assess({ consensus: 'StrongBuy' }).composite).toBe(100);
    expect(assess({ consensus: 'StrongBuy', smartScore: 5.5 }).composite).toBe(50);
  });
});

describe('the tiers', () => {
  it('start at the scores the page gives, and end where the next one starts', () => {
    const scored = TIER_RULES.filter((rule) => rule.from !== null);

    for (const rule of scored) {
      const from = rule.from as number;
      expect(tierOf(from)).toBe(rule.tier);
      expect(tierOf(from - 1)).not.toBe(rule.tier);
      expect(rule.range).toContain(String(from));
    }
    // "35 to 59" ends one below where Strong starts, and so on up the table.
    scored.slice(1).forEach((rule, index) => {
      expect(rule.range).toContain(String((scored[index].from as number) - 1));
    });
  });

  it('give no tier below the weakest bound, and none at all without a score', () => {
    const weakest = TIER_RULES.find((rule) => rule.tier === 'Weak')!;
    const lowest = Math.min(...TIER_RULES.map((rule) => rule.from ?? Infinity));

    expect(tierOf(lowest - 1)).toBe('Weak');
    expect(weakest.range).toBe(`below ${lowest}`);
    expect(tierOf(null)).toBe('NoData');
  });

  it('list every tier once, strongest first', () => {
    expect(TIER_RULES.map((rule) => rule.tier)).toEqual([
      'Strong',
      'Supported',
      'Mixed',
      'Weak',
      'NoData',
    ]);
  });
});

describe('the verdicts', () => {
  /** Every verdict the scorer can give a tier, over the edges of the rules the page states. */
  function reachable(tier: Tier): Verdict[] {
    const found = new Set<Verdict>();
    for (const count of [0, 1, 2, 3, 4]) {
      for (const weight of [
        0,
        BIG_POSITION_PCT,
        LARGE_POSITION_PCT - 0.1,
        LARGE_POSITION_PCT,
        60,
      ]) {
        for (const priced of [false, true]) {
          const flags = warnings(count, priced ? [flag('priced_at_target')] : []);
          found.add(verdictOf(tier, flags, weight));
        }
      }
    }
    return [...found];
  }

  it.each(TIER_RULES.map((rule) => [rule.tier, rule] as const))(
    'of a %s holding are the ones the page lists',
    (tier, rule) => {
      expect(rule.outcomes.map((outcome) => outcome.verdict).sort()).toEqual(
        reachable(tier).sort(),
      );
    },
  );

  it('mark a strong hold as Hold \u00b7 size from 25% of the account', () => {
    expect(verdictOf('Strong', [], LARGE_POSITION_PCT - 0.1)).toBe('Hold');
    expect(verdictOf('Strong', [], LARGE_POSITION_PCT)).toBe('HoldReviewSize');
    expect(verdictOf('Strong', warnings(4), 5)).toBe('Hold');
    expect(LARGE_POSITION_PCT).toBe(25);
  });

  it('turn a supported holding to Watch at two warnings, or at its target', () => {
    expect(verdictOf('Supported', warnings(1), 5)).toBe('Hold');
    expect(verdictOf('Supported', warnings(2), 5)).toBe('Watch');
    expect(verdictOf('Supported', [flag('priced_at_target')], 5)).toBe('Watch');
  });

  it('turn a mixed holding to Review at three warnings', () => {
    expect(verdictOf('Mixed', warnings(2), 5)).toBe('Watch');
    expect(verdictOf('Mixed', warnings(3), 5)).toBe('Review');
  });

  it('send a weak holding to Review whatever else is said, and leave the unscored without one', () => {
    expect(verdictOf('Weak', [], 0)).toBe('Review');
    expect(verdictOf('Weak', warnings(4), 40)).toBe('Review');
    expect(verdictOf('NoData', [], 5)).toBe('NoData');
  });

  it('count only warnings and alerts, never info', () => {
    const info = Array.from({ length: 5 }, (_, index) => flag(`info-${index}`, 'Info'));

    expect(verdictOf('Mixed', info, 5)).toBe('Watch');
    expect(verdictOf('Supported', [...info, flag('one')], 5)).toBe('Hold');
  });

  it('call a holding material from 1% of the account', () => {
    expect(assess(calm(), { weight: MATERIAL_PCT }).material).toBe(true);
    expect(assess(calm(), { weight: MATERIAL_PCT - 0.1 }).material).toBe(false);
    expect(MATERIAL_NOTE).toContain(`${MATERIAL_PCT}%`);
  });
});

describe('the flags', () => {
  const day = (offset: number) => {
    const date = new Date(Date.parse(`${TODAY}T00:00:00Z`) + offset * 86_400_000);
    return date.toISOString().slice(0, 10);
  };

  // Each case is a holding at an edge of a rule: the flag it raises there, or null just short of it.
  const cases: [string, () => HoldingAssessment, string, FlagSeverity | null][] = [
    ['25% of the account', () => assess(calm(), { weight: 25 }), 'concentration', 'Alert'],
    ['10% of the account', () => assess(calm(), { weight: 10 }), 'concentration', 'Warn'],
    ['just under 10% of the account', () => assess(calm(), { weight: 9.9 }), 'concentration', null],
    [
      'a target 2.5% above the price',
      () => assess(calm({ priceTarget: 102.5, lastPrice: 100 })),
      'priced_at_target',
      'Warn',
    ],
    [
      'a target 3.5% above the price',
      () => assess(calm({ priceTarget: 103.5, lastPrice: 100 })),
      'priced_at_target',
      null,
    ],
    [
      'a target below the price',
      () => assess(calm({ priceTarget: 90, lastPrice: 100 })),
      'priced_at_target',
      'Warn',
    ],
    [
      'a target at the price, with only 2 analysts having set one',
      () => assess(calm({ priceTarget: 100, lastPrice: 100, breadth: breadth(12, 9, 1, 2) })),
      'priced_at_target',
      null,
    ],
    [
      'Street upside 25 points above the AI',
      () =>
        assess(
          calm({
            priceTarget: 150,
            lastPrice: 100,
            ai: { score: 80, rating: null, priceTarget: null, upsidePct: 25, asOf: null },
          }),
        ),
      'dispersion',
      'Warn',
    ],
    [
      'Street upside 24 points above the AI',
      () =>
        assess(
          calm({
            priceTarget: 150,
            lastPrice: 100,
            ai: { score: 80, rating: null, priceTarget: null, upsidePct: 26, asOf: null },
          }),
        ),
      'dispersion',
      null,
    ],
    ['a Neutral consensus', () => assess(calm({ consensus: 'Neutral' })), 'weak_consensus', 'Warn'],
    ['a Sell consensus', () => assess(calm({ consensus: 'Sell' })), 'weak_consensus', 'Warn'],
    ['a Buy consensus', () => assess(calm({ consensus: 'Buy' })), 'weak_consensus', null],
    ['4 analysts', () => assess(calm({ breadth: breadth(4) })), 'thin_coverage', 'Warn'],
    ['5 analysts', () => assess(calm({ breadth: breadth(5) })), 'thin_coverage', null],
    [
      'day and week both Sell',
      () => assess(calm({ technicalDay: 'Sell', technicalWeek: 'Sell' })),
      'weak_trend',
      'Warn',
    ],
    [
      'a Buy day and a Sell week, which average out',
      () => assess(calm({ technicalDay: 'Buy', technicalWeek: 'Sell' })),
      'weak_trend',
      null,
    ],
    [
      'earnings in 30 days',
      () => assess(calm({ nextEarningsDate: day(30) })),
      'earnings_soon',
      'Info',
    ],
    [
      'earnings in 31 days',
      () => assess(calm({ nextEarningsDate: day(31) })),
      'earnings_soon',
      null,
    ],
    [
      'down 40% on a strong score',
      () => assess(calm(), { holding: { pnlPct: -40 } }),
      'deep_loss',
      'Info',
    ],
    [
      'down 40% on a score below 35',
      () => assess(weak(), { holding: { pnlPct: -40 } }),
      'deep_loss',
      'Warn',
    ],
    [
      'down 40% with no score',
      () => assess(null, { holding: { assetClass: 'Crypto', pnlPct: -40 } }),
      'deep_loss',
      'Info',
    ],
    ['down 39.9%', () => assess(calm(), { holding: { pnlPct: -39.9 } }), 'deep_loss', null],
    ['down 25% over 12 months', () => assess(calm({ yearlyGainPct: -25 })), 'year_decline', 'Info'],
    [
      'down 24.9% over 12 months',
      () => assess(calm({ yearlyGainPct: -24.9 })),
      'year_decline',
      null,
    ],
    ['a stock with no signals yet', () => assess(null), 'not_synced', 'Info'],
    ['crypto', () => assess(null, { holding: { assetClass: 'Crypto' } }), 'no_coverage', 'Info'],
    ['a fund', () => assess(null, { holding: { assetClass: 'Etf' } }), 'no_coverage', 'Info'],
  ];

  it.each(cases)('%s', (_, build, key, severity) => {
    const raised = build().flags.find((candidate) => candidate.key === key);

    expect(raised?.severity ?? null).toBe(severity);
  });

  it('are exactly the flags the page describes, with the severities the scorer gives them', () => {
    const seen = new Map<string, Set<FlagSeverity>>();
    for (const [, build] of cases) {
      for (const raised of build().flags) {
        seen.set(raised.key, (seen.get(raised.key) ?? new Set()).add(raised.severity));
      }
    }

    expect(FLAG_RULES.map((rule) => rule.key).sort()).toEqual([...seen.keys()].sort());
    for (const rule of FLAG_RULES) {
      expect(new Set(rule.severities)).toEqual(seen.get(rule.key));
    }
  });

  it('say the numbers the cases test', () => {
    const says = (key: string) => FLAG_RULES.find((rule) => rule.key === key)!.rule;

    expect(says('concentration')).toContain(`${LARGE_POSITION_PCT}%`);
    expect(says('concentration')).toContain(`${BIG_POSITION_PCT}%`);
    expect(says('priced_at_target')).toContain('3%');
    expect(says('priced_at_target')).toContain('fewer than 3 analysts');
    expect(says('dispersion')).toContain('25 points');
    expect(says('thin_coverage')).toContain('5 analysts');
    expect(says('earnings_soon')).toContain('30 days');
    expect(says('deep_loss')).toContain('40%');
    expect(says('deep_loss')).toContain('below 35');
    expect(says('year_decline')).toContain('25%');
    expect(LARGE_POSITION_PCT).toBe(25);
    expect(BIG_POSITION_PCT).toBe(10);
  });

  it('give each rule its severities most serious first', () => {
    const order: FlagSeverity[] = ['Alert', 'Warn', 'Info'];

    for (const rule of FLAG_RULES) {
      const ranks = rule.severities.map((severity) => order.indexOf(severity));
      expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
    }
  });
});
