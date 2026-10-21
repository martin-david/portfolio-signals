import { makeAnalysis, makeRow } from '@/test/analysisBuilders';
import { loadDemo } from '@/test/demo';

import { buildStripSegments, describeStrip } from './strip';

describe('buildStripSegments', () => {
  it('splits the account by verdict, then copy trading and cash, and adds up to the whole account', async () => {
    const { analysis, portfolio } = await loadDemo();

    const segments = buildStripSegments(analysis, portfolio.account);

    expect(segments.map((s) => s.key)).toEqual([
      'size',
      'hold',
      'watch',
      'review',
      'nodata',
      'copy',
      'cash',
    ]);
    expect(segments.reduce((sum, s) => sum + s.pct, 0)).toBeCloseTo(100, 6);
    expect(segments.reduce((sum, s) => sum + s.value, 0)).toBe(portfolio.account.totalValue);
    const size = segments[0];
    expect(size.detail).toBe('NWND');
    expect(size.name).toBe('Hold, review size');
    expect(segments.find((s) => s.key === 'copy')?.value).toBe(portfolio.account.copiedValue);
    expect(segments.find((s) => s.key === 'cash')?.value).toBe(portfolio.account.availableCash);
  });

  it('names a few symbols per segment and counts the rest', async () => {
    const { analysis, portfolio } = await loadDemo();

    const hold = buildStripSegments(analysis, portfolio.account).find((s) => s.key === 'hold');

    expect(hold?.detail).toMatch(/^[A-Z.]+(, [A-Z.]+){5} and \d+ more$/);
  });

  it('shows what the verdicts do not cover as one segment when the account split is unknown', async () => {
    const { analysis } = await loadDemo();

    const segments = buildStripSegments(analysis);

    expect(segments.at(-1)).toMatchObject({
      key: 'copy',
      name: 'Copy trading and cash, not assessed',
    });
    expect(segments.reduce((sum, s) => sum + s.pct, 0)).toBeCloseTo(100, 6);
  });

  it('leaves out segments that hold nothing', () => {
    const analysis = makeAnalysis([makeRow({ symbol: 'AAA', verdict: 'Hold', value: 100_000 })], {
      totalValue: 100_000,
      directValue: 100_000,
    });

    expect(buildStripSegments(analysis).map((s) => s.key)).toEqual(['hold']);
  });

  it('copes with an empty account', () => {
    expect(buildStripSegments(makeAnalysis([], { totalValue: 0, directValue: 0 }))).toEqual([]);
  });

  it('describes the strip for assistive technology', () => {
    expect(
      describeStrip([
        { key: 'hold', name: 'Hold', detail: 'AAA', value: 70, pct: 70.4 },
        { key: 'watch', name: 'Watch', detail: 'BBB', value: 30, pct: 29.6 },
      ]),
    ).toBe('Hold 70 percent, Watch 30 percent');
  });
});
