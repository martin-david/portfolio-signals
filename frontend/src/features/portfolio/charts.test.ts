import { makeAnalysis, makeRow } from '@/test/analysisBuilders';
import { loadDemo } from '@/test/demo';

import { earningsByDay, targetGaps, targetRows } from './charts';

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
