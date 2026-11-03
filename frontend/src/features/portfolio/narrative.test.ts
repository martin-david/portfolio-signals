import { makeAnalysis, makeRow } from '@/test/analysisBuilders';
import { loadDemo } from '@/test/demo';

import { attentionItems, buildFindings, buildHeadline, describeSnapshot } from './narrative';

describe('describeSnapshot', () => {
  const now = new Date('2026-10-21T12:00:00Z');

  it('says when the portfolio was saved and the signals fetched, and how long ago', () => {
    const meta = describeSnapshot(
      { asOf: '2026-10-21T10:00:00Z', signalsFetchedAt: '2026-10-20T12:00:00Z' },
      now,
    );

    expect(meta.snapshot).toBe('eToro snapshot of 21 Oct 2026, 10:00 UTC (2 hours ago)');
    expect(meta.signals).toBe('TipRanks signals from 20 Oct 2026, 12:00 UTC (1 day ago)');
  });

  it('says so when TipRanks has delivered nothing yet', () => {
    expect(
      describeSnapshot({ asOf: '2026-10-21T10:00:00Z', signalsFetchedAt: null }, now).signals,
    ).toBe('No TipRanks signals yet');
  });

  it('leaves out "ago" once the date alone says it, after two weeks', () => {
    const meta = describeSnapshot(
      { asOf: '2026-09-01T09:30:00Z', signalsFetchedAt: '2026-09-01T09:31:00Z' },
      now,
    );

    expect(meta.snapshot).toBe('eToro snapshot of 1 Sep 2026, 09:30 UTC');
    expect(meta.signals).toBe('TipRanks signals from 1 Sep 2026, 09:31 UTC');
  });
});

describe('buildHeadline', () => {
  it('says there is nothing to assess when no holding matters', () => {
    const analysis = makeAnalysis([makeRow({ symbol: 'AAA', weightPct: 0.4 })]);

    expect(buildHeadline(analysis).headline).toBe('No holding is above 1% of your account yet.');
  });

  it('says there is nothing to assess when the snapshot holds no positions at all', () => {
    const { headline, lede } = buildHeadline(makeAnalysis([]));

    expect(headline).toBe('There are no open positions to assess.');
    expect(lede).toContain('Copy trading and cash are not assessed');
  });

  it('says the signals have not arrived when every position that matters has no data', () => {
    const analysis = makeAnalysis([
      makeRow({ symbol: 'AAA', verdict: 'NoData' }),
      makeRow({ symbol: 'BBB', verdict: 'NoData' }),
    ]);

    const { headline, lede } = buildHeadline(analysis);

    expect(headline).toBe('Analyst signals have not arrived yet.');
    expect(lede).toContain('Connect TipRanks');
  });

  it('backs every position that matters when all are holds', () => {
    const analysis = makeAnalysis([
      makeRow({ symbol: 'AAA', verdict: 'Hold', weightPct: 10 }),
      makeRow({ symbol: 'BBB', verdict: 'Hold', weightPct: 5 }),
      makeRow({ symbol: 'CCC', verdict: 'Watch', weightPct: 0.5 }),
    ]);

    const { headline, lede } = buildHeadline(analysis);

    expect(headline).toBe('Analysts back every position that matters.');
    expect(lede).toContain('Every holding above 1% of your account is a Hold.');
  });

  it('leaves size to decide when the largest hold is very large', () => {
    const analysis = makeAnalysis([
      makeRow({ symbol: 'BIG', verdict: 'HoldReviewSize', weightPct: 32.12 }),
      makeRow({ symbol: 'AAA', verdict: 'Hold', weightPct: 5 }),
    ]);

    const { headline, lede } = buildHeadline(analysis);

    expect(headline).toBe(
      'Analysts back every position that matters. What is left to decide is size.',
    );
    expect(lede).toBe(
      'BIG is 32.1% of your account. Its verdict is Hold, but a position this large is a decision about size, not about analysts.',
    );
  });

  it('counts the positions that deserve a second look and names them by verdict', () => {
    const analysis = makeAnalysis([
      makeRow({ symbol: 'BIG', verdict: 'HoldReviewSize', weightPct: 30 }),
      makeRow({ symbol: 'WAT', verdict: 'Watch', weightPct: 12 }),
      makeRow({ symbol: 'TCH', verdict: 'Watch', weightPct: 8 }),
      makeRow({ symbol: 'REV', verdict: 'Review', weightPct: 6 }),
      makeRow({ symbol: 'TNY', verdict: 'Review', weightPct: 0.3 }),
    ]);

    const { headline, lede } = buildHeadline(analysis);

    expect(headline).toBe('Three positions above 1% deserve a second look.');
    expect(lede).toBe(
      'Review: REV. Watch: WAT, TCH. BIG is a Hold but is also large enough to review for size. Review means look again, not sell.',
    );
  });

  it('uses the singular for one position', () => {
    const analysis = makeAnalysis([
      makeRow({ symbol: 'WAT', verdict: 'Watch', weightPct: 12 }),
      makeRow({ symbol: 'AAA', verdict: 'Hold', weightPct: 5 }),
    ]);

    expect(buildHeadline(analysis).headline).toBe('One position above 1% deserves a second look.');
  });

  it('reads the demo portfolio without naming anything that is not in it', async () => {
    const { analysis } = await loadDemo();

    const { headline, lede } = buildHeadline(analysis);

    expect(headline).toMatch(/positions above 1% deserve a second look\.$/);
    expect(lede).toMatch(/Review: TLSP\./);
    expect(lede).toMatch(/Watch: [A-Z]+, /);
    expect(lede).toContain('NWND is a Hold but is also large enough');
  });
});

describe('buildFindings', () => {
  it('writes the four findings from the demo KPIs', async () => {
    const { analysis } = await loadDemo();

    const findings = buildFindings(analysis);

    expect(findings.map((f) => f.key)).toEqual([
      'quality',
      'concentration',
      'timing',
      'housekeeping',
    ]);
    const text = (key: string) =>
      findings
        .find((f) => f.key === key)!
        .body.map((part) => (typeof part === 'string' ? part : `[${part.amount}]`))
        .join('');
    expect(text('concentration')).toMatch(
      /^Your largest position is 3\d\.\d% of the account and the top five are \d+\.\d%\./,
    );
    expect(text('timing')).toContain('NWND');
    expect(text('timing')).toMatch(/^Six of your holdings report earnings within 30 days/);
    expect(text('housekeeping')).toMatch(
      /^Four of your 15 positions are each under 1% of the account; together they are \d\.\d% \(\[\d+\]\)\./,
    );
  });

  it('keeps amounts out of the text so they can be hidden', async () => {
    const { analysis } = await loadDemo();

    const housekeeping = buildFindings(analysis).find((f) => f.key === 'housekeeping')!;

    expect(housekeeping.body.some((part) => typeof part === 'object')).toBe(true);
    expect(housekeeping.body.filter((part) => typeof part === 'string').join('')).not.toMatch(/\$/);
  });

  it('judges quality by the share of assessed value that is a hold', () => {
    const rows = (hold: number, watch: number) => [
      makeRow({ symbol: 'AAA', verdict: 'Hold', value: hold }),
      makeRow({ symbol: 'BBB', verdict: 'Watch', value: watch }),
      makeRow({ symbol: 'CCC', verdict: 'NoData', value: 50_000 }),
    ];
    const title = (hold: number, watch: number) =>
      buildFindings(makeAnalysis(rows(hold, watch))).find((f) => f.key === 'quality')!.title;

    expect(title(80, 20)).toBe('Quality is not the question.');
    expect(title(60, 40)).toBe('Most of the assessed account is backed.');
    expect(title(30, 70)).toBe('Much of the assessed account needs a look.');
  });

  it('leaves quality out when nothing was assessed', () => {
    const findings = buildFindings(makeAnalysis([makeRow({ symbol: 'AAA', verdict: 'NoData' })]));

    expect(findings.map((f) => f.key)).not.toContain('quality');
  });

  it('says so when nothing reports earnings soon and omits housekeeping when nothing is small', () => {
    const findings = buildFindings(makeAnalysis([makeRow({ symbol: 'AAA' })]));

    expect(findings.find((f) => f.key === 'timing')).toMatchObject({
      title: 'No earnings within 30 days.',
    });
    expect(findings.map((f) => f.key)).not.toContain('housekeeping');
  });

  it('uses the singular for one earnings date and one small position', () => {
    const findings = buildFindings(
      makeAnalysis([makeRow({ symbol: 'AAA' })], {
        earnings30DaysSymbols: ['AAA'],
        earnings30DaysPct: 12.5,
        smallPositions: { count: 1, value: 300, pct: 0.3 },
        positions: 9,
      }),
    );

    const text = (key: string) =>
      findings
        .find((f) => f.key === key)!
        .body.map((part) => (typeof part === 'string' ? part : '#'))
        .join('');
    expect(text('timing')).toBe(
      'One of your holdings reports earnings within 30 days (AAA), together 12.5% of the account.',
    );
    expect(text('housekeeping')).toMatch(
      /^One of your 9 positions is under 1% of the account; together they are 0\.3% \(#\)\./,
    );
  });
});

describe('attentionItems', () => {
  it('lists positions above 1% that are on watch, to review or large, biggest first, with their warnings', async () => {
    const { analysis } = await loadDemo();

    const items = attentionItems(analysis);

    expect(items.map((i) => i.symbol)).toEqual(expect.arrayContaining(['NWND', 'TLSP']));
    expect(items.map((i) => i.weightPct)).toEqual(
      [...items.map((i) => i.weightPct)].sort((a, b) => b - a),
    );
    const tlsp = items.find((i) => i.symbol === 'TLSP')!;
    expect(tlsp.verdict).toBe('Review');
    expect(tlsp.reasons).toHaveLength(2);
    expect(items.every((i) => i.verdict !== 'Hold' && i.verdict !== 'NoData')).toBe(true);
  });

  it('honours the limit and skips the small positions', () => {
    const analysis = makeAnalysis([
      makeRow({ symbol: 'A', verdict: 'Watch', weightPct: 9 }),
      makeRow({ symbol: 'B', verdict: 'Review', weightPct: 8 }),
      makeRow({ symbol: 'C', verdict: 'Watch', weightPct: 0.5 }),
    ]);

    expect(attentionItems(analysis, 1).map((i) => i.symbol)).toEqual(['A']);
    expect(attentionItems(analysis).map((i) => i.symbol)).toEqual(['A', 'B']);
  });
});
