import { makeAnalysis, makeRow } from '@/test/analysisBuilders';
import { loadDemo } from '@/test/demo';

import {
  TARGET_AXIS,
  axisX,
  describeGaps,
  describeTargets,
  earningsByDay,
  earningsHeading,
  earningsScaleMax,
  earningsSegments,
  earningsSummary,
  earningsTicks,
  labelWidth,
  targetGaps,
  targetMarks,
  targetRows,
  type EarningsDay,
  type TargetRow,
} from './charts';

function withEarnings(
  symbol: string,
  weightPct: number,
  daysToEarnings: number | null,
  date: string | null,
) {
  const base = makeRow({ symbol, weightPct });
  return makeRow({
    symbol,
    weightPct,
    assessment: { facts: { ...base.assessment.facts, daysToEarnings, nextEarningsDate: date } },
  });
}

describe('earningsByDay', () => {
  it('groups the stocks reporting within the window by day, in date order, biggest first', () => {
    const analysis = makeAnalysis([
      withEarnings('AAA', 10, 24, '2026-11-14'),
      withEarnings('BBB', 30, 24, '2026-11-14'),
      withEarnings('CCC', 5, 6, '2026-10-27'),
      withEarnings('DDD', 8, 90, '2027-01-19'),
      withEarnings('EEE', 4, -2, '2026-10-19'),
      withEarnings('FFF', 3, null, null),
    ]);

    const days = earningsByDay(analysis);

    expect(days.map((d) => d.date)).toEqual(['2026-10-27', '2026-11-14']);
    expect(days[1].items.map((i) => i.symbol)).toEqual(['BBB', 'AAA']);
    expect(days[1].totalPct).toBe(40);
  });

  it('ignores holdings that are not stocks and accepts a longer window', () => {
    const fund = makeRow({
      symbol: 'ETF',
      assetClass: 'Etf',
      assessment: {
        facts: {
          ...makeRow({ symbol: 'ETF' }).assessment.facts,
          daysToEarnings: 3,
          nextEarningsDate: '2026-10-24',
        },
      },
    });
    const far = withEarnings('FAR', 5, 90, '2027-01-19');

    expect(earningsByDay(makeAnalysis([fund, far]))).toEqual([]);
    expect(earningsByDay(makeAnalysis([fund, far]), 120).map((d) => d.date)).toEqual([
      '2027-01-19',
    ]);
  });

  it('finds the earnings cluster of the demo portfolio', async () => {
    const { analysis } = await loadDemo();

    const days = earningsByDay(analysis);
    const biggest = [...days].sort((a, b) => b.totalPct - a.totalPct)[0];

    expect(biggest.items.map((i) => i.symbol)).toEqual(['NWND', 'CTSO', 'WGTP']);
    expect(biggest.totalPct).toBeGreaterThan(40);
  });
});

describe('targetRows and targetGaps', () => {
  it('lists the holdings whose target upside is scored, biggest first', async () => {
    const { analysis } = await loadDemo();

    const rows = targetRows(analysis);

    expect(rows[0].symbol).toBe('NWND');
    expect(rows.map((r) => r.weightPct)).toEqual(
      [...rows.map((r) => r.weightPct)].sort((a, b) => b - a),
    );
    expect(rows.find((r) => r.symbol === 'ORBT')).toBeUndefined();
    const adwk = rows.find((r) => r.symbol === 'ADWK')!;
    expect(adwk.street).toBeGreaterThan(adwk.ai!);
  });

  it('finds where the Street and the AI models split and where they agree', () => {
    const rows = [
      {
        symbol: 'A',
        weightPct: 10,
        street: 15.4,
        ai: -10,
        analysts: 19,
        verdict: 'Watch' as const,
      },
      { symbol: 'B', weightPct: 8, street: 12, ai: 10, analysts: 20, verdict: 'Hold' as const },
      { symbol: 'C', weightPct: 6, street: 3, ai: 30, analysts: 20, verdict: 'Hold' as const },
      { symbol: 'D', weightPct: 5, street: 20, ai: null, analysts: 9, verdict: 'Hold' as const },
    ];

    const gaps = targetGaps(rows);

    expect(gaps.widest).toEqual([
      { symbol: 'A', gap: 25.4 },
      { symbol: 'B', gap: 2 },
      { symbol: 'C', gap: -27 },
    ]);
    expect(gaps.agree).toEqual(['B']);
    expect(targetGaps(rows, 1).widest).toHaveLength(1);
  });
});

const targetRow = (overrides: Partial<TargetRow> = {}): TargetRow => ({
  symbol: 'NWND',
  weightPct: 32,
  street: 11.3,
  ai: 13.6,
  analysts: 31,
  verdict: 'HoldReviewSize',
  ...overrides,
});

describe('the targets chart', () => {
  it('puts a value on the scale, keeps it off the edge, and holds one off the scale at its end', () => {
    const width = 400;

    expect(axisX(TARGET_AXIS.min, TARGET_AXIS, width)).toBe(8);
    expect(axisX(TARGET_AXIS.max, TARGET_AXIS, width)).toBe(392);
    expect(axisX(-500, TARGET_AXIS, width)).toBe(8);
    expect(axisX(900, TARGET_AXIS, width)).toBe(392);
    // 0 is 60 of the 190 points along the scale.
    expect(axisX(0, TARGET_AXIS, width)).toBeCloseTo(8 + (60 / 190) * 384, 6);
  });

  it('places the Street target and the AI target, and the grid the reader measures against', () => {
    const marks = targetMarks(targetRow(), 400);

    expect(marks.street).toBeCloseTo(axisX(11.3, TARGET_AXIS, 400), 6);
    expect(marks.ai).toBeCloseTo(axisX(13.6, TARGET_AXIS, 400), 6);
    expect(marks.ai!).toBeGreaterThan(marks.street);
    expect(marks.grid.map((line) => line.value)).toEqual([-50, 0, 50, 100]);
    expect(marks.grid.map((line) => line.x)).toEqual(
      [...marks.grid.map((line) => line.x)].sort((a, b) => a - b),
    );
  });

  it('has no AI mark when there is no AI target', () => {
    expect(targetMarks(targetRow({ ai: null }), 400).ai).toBeNull();
  });

  it('says the numbers behind a row in words', () => {
    expect(describeTargets(targetRow())).toBe('Street +11.3% \u00b7 AI +13.6% \u00b7 31 analysts');
    expect(describeTargets(targetRow({ ai: null, street: -4.2, analysts: 1 }))).toBe(
      'Street \u22124.2% \u00b7 AI n/a \u00b7 1 analyst',
    );
    expect(describeTargets(targetRow({ analysts: null }))).toBe('Street +11.3% \u00b7 AI +13.6%');
  });

  it('describes where the Street and the models split and where they agree', () => {
    const text = describeGaps({
      widest: [
        { symbol: 'BABA', gap: 43.2 },
        { symbol: 'NET', gap: 27 },
        { symbol: 'AAA', gap: 3 },
      ],
      agree: ['AAA', 'BBB'],
    });

    expect(text).toBe(
      'All values are a percent above or below today\u2019s price. The widest splits are BABA (+43 points), NET (+27 points), where the Street is more optimistic than the models. They roughly agree (within 5 points) on AAA, BBB.',
    );
  });

  it('leaves out what there is nothing to say about', () => {
    expect(describeGaps({ widest: [], agree: [] })).toBe(
      'All values are a percent above or below today\u2019s price.',
    );
    expect(describeGaps({ widest: [{ symbol: 'A', gap: -20 }], agree: [] })).not.toContain(
      'widest',
    );
  });
});

const day = (date: string, items: [string, number][]): EarningsDay => ({
  date,
  items: items.map(([symbol, weightPct]) => ({ symbol, weightPct })),
  totalPct: items.reduce((sum, [, weight]) => sum + weight, 0),
});

describe('the earnings chart', () => {
  it('scales to at least half the account, in steps of a quarter', () => {
    expect(earningsScaleMax([])).toBe(50);
    expect(earningsScaleMax([day('2026-11-04', [['A', 30]])])).toBe(50);
    expect(earningsScaleMax([day('2026-11-04', [['A', 50]])])).toBe(50);
    expect(earningsScaleMax([day('2026-11-04', [['A', 50.1]])])).toBe(75);
    expect(earningsTicks(50)).toEqual([0, 25, 50]);
    expect(earningsTicks(75)).toEqual([0, 25, 50, 75]);
  });

  it('draws a day as segments side by side, each as wide as its share of the account', () => {
    const segments = earningsSegments(
      day('2026-11-04', [
        ['BIG', 30],
        ['MID', 10],
        ['TNY', 0.2],
      ]),
      50,
      500,
    );

    expect(segments.map((s) => s.symbol)).toEqual(['BIG', 'MID', 'TNY']);
    expect(segments[0]).toEqual({ symbol: 'BIG', x: 0, width: 300, labelled: true });
    expect(segments[1].x).toBeCloseTo(301.5, 6);
    expect(segments[1].width).toBe(100);
    // A sliver is still visible, and too narrow to carry its name.
    expect(segments[2].width).toBe(2);
    expect(segments[2].labelled).toBe(false);
  });

  it('labels only the segments with room for their name, so a long name needs a wider bar', () => {
    const [short, tight, long] = earningsSegments(
      day('2026-11-04', [
        ['AAA', 3],
        ['BBBB', 5],
        ['CCCC.DD', 5],
      ]),
      50,
      500,
    );

    expect(short.width).toBe(30);
    expect(short.labelled).toBe(false);
    expect(labelWidth('AAA')).toBe(36.5);
    expect(tight.width).toBe(50);
    expect(tight.labelled).toBe(true);
    expect(long.width).toBe(50);
    expect(long.labelled).toBe(false);
    expect(labelWidth('CCCC.DD')).toBe(66.5);
  });

  it('turns into a headline when one day carries a large share of the account', () => {
    const days = [
      day('2026-11-04', [['A', 10]]),
      day('2026-11-15', [
        ['B', 30],
        ['C', 15],
      ]),
    ];

    expect(earningsHeading(days)).toBe('45% of the account reports on Nov 15');
    expect(earningsHeading([day('2026-11-04', [['A', 39]])])).toBe('When your holdings report');
    expect(earningsHeading([])).toBe('When your holdings report');
  });

  it('summarises the busiest day', () => {
    const days = [
      day('2026-11-04', [['A', 10]]),
      day('2026-11-15', [
        ['B', 30],
        ['C', 15],
        ['D', 4],
      ]),
    ];

    expect(earningsSummary(days)).toBe(
      'B, C and D report on Nov 15, together 49.0% of the account. Earnings days are where analyst targets get tested, so they are the natural moments to read the verdicts again.',
    );
    expect(earningsSummary([day('2026-11-04', [['A', 10]])])).toContain('A reports on Nov 4');
    expect(
      earningsSummary([
        day('2026-11-04', [
          ['A', 10],
          ['B', 2],
        ]),
      ]),
    ).toContain('A and B report');
    expect(earningsSummary([])).toBe('');
  });
});
