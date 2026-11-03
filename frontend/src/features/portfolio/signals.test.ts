import { loadDemo } from '@/test/demo';
import { makeRow } from '@/test/analysisBuilders';

import { noSignalsReason, signalCells, signalLines, toneOf } from './signals';

describe('toneOf', () => {
  it.each([
    [null, 'neutral'],
    [undefined, 'neutral'],
    [1, 'good'],
    [0.35, 'good'],
    [0.34, 'neutral'],
    [0, 'neutral'],
    [-0.15, 'bad'],
    [-0.14, 'neutral'],
    [-1, 'bad'],
  ])('%s is %s', (component, tone) => {
    expect(toneOf(component)).toBe(tone);
  });
});

describe('signalCells', () => {
  it('describes the six signals of a strongly supported holding', async () => {
    const { analysis } = await loadDemo();
    const nwnd = analysis.holdings.find((h) => h.holding.symbol === 'NWND')!;

    const cells = signalCells(nwnd);

    expect(cells.map((c) => c.key)).toEqual([
      'smartScore',
      'consensus',
      'upside',
      'ai',
      'trend',
      'breadth',
    ]);
    expect(cells.every((c) => c.present)).toBe(true);
    const byKey = Object.fromEntries(cells.map((c) => [c.key, c]));
    expect(byKey.smartScore).toMatchObject({
      value: 9,
      text: '9/10',
      tone: 'good',
      min: 1,
      max: 10,
      zone: [8, 10],
    });
    expect(byKey.consensus).toMatchObject({ text: 'Strong Buy', tone: 'good', value: 1 });
    expect(byKey.upside.text).toBe('+11.3%');
    expect(byKey.upside.spoken).toBe('Target upside +11.3 percent');
    expect(byKey.ai).toMatchObject({ text: '82/100', spoken: 'AI score 82 of 100' });
    expect(byKey.trend.text).toBe('Strong Buy');
    expect(byKey.breadth.text).toBe('31 analysts');
  });

  it('reports why a signal is missing', async () => {
    const { analysis } = await loadDemo();
    const frth = analysis.holdings.find((h) => h.holding.symbol === 'FRTH')!;
    const ltwr = analysis.holdings.find((h) => h.holding.symbol === 'LTWR')!;

    const frthCells = Object.fromEntries(signalCells(frth).map((c) => [c.key, c]));
    expect(frthCells.ai).toMatchObject({ present: false, missing: 'no AI score' });
    expect(frthCells.trend).toMatchObject({ present: false, missing: 'n/a' });
    expect(frthCells.breadth).toMatchObject({ present: false, missing: '1 analyst' });

    const ltwrCells = Object.fromEntries(signalCells(ltwr).map((c) => [c.key, c]));
    expect(ltwrCells.breadth).toMatchObject({ present: false, missing: '3 analysts' });
  });

  it('says there is no price target, or too few targets to trust', () => {
    const none = makeRow({
      symbol: 'AAA',
      assessment: { facts: { ...makeRow({ symbol: 'AAA' }).assessment.facts, priceTarget: null } },
    });
    const few = makeRow({
      symbol: 'BBB',
      assessment: {
        facts: {
          ...makeRow({ symbol: 'BBB' }).assessment.facts,
          priceTarget: 10,
          streetUpsidePct: 5,
        },
      },
    });

    expect(signalCells(none).find((c) => c.key === 'upside')?.missing).toBe('no price target');
    expect(signalCells(few).find((c) => c.key === 'upside')).toMatchObject({
      present: false,
      missing: 'few targets',
    });
  });

  it('maps the technical trend to a word', () => {
    const word = (technicals: number) =>
      signalCells(
        makeRow({
          symbol: 'AAA',
          assessment: {
            components: {
              consensus: null,
              upside: null,
              smartScore: null,
              aiScore: null,
              technicals,
              breadth: null,
            },
          },
        }),
      ).find((c) => c.key === 'trend')!.text;

    expect(word(1)).toBe('Strong Buy');
    expect(word(0.5)).toBe('Buy');
    expect(word(0)).toBe('Neutral');
    expect(word(-0.5)).toBe('Sell');
    expect(word(-1)).toBe('Strong Sell');
  });
});

describe('signalLines', () => {
  it('lists only the signals that exist, in words for narrow screens', async () => {
    const { analysis } = await loadDemo();
    const frth = analysis.holdings.find((h) => h.holding.symbol === 'FRTH')!;

    expect(signalLines(frth)).toEqual(
      expect.arrayContaining(['Smart Score 6/10', 'Consensus Buy']),
    );
    expect(signalLines(frth).join(' ')).not.toContain('AI models');
    const nwnd = analysis.holdings.find((h) => h.holding.symbol === 'NWND')!;
    expect(signalLines(nwnd)).toContain('Trend Strong Buy');
  });
});

describe('noSignalsReason', () => {
  it('explains crypto, funds and holdings that have not been synced', async () => {
    const { analysis } = await loadDemo();
    const reason = (symbol: string) =>
      noSignalsReason(analysis.holdings.find((h) => h.holding.symbol === symbol)!);

    expect(reason('ORBT')).toBe(
      'TipRanks publishes no ratings, Smart Score or AI score for crypto.',
    );
    expect(reason('TREY')).toBe('Only single stocks are scored.');
    expect(reason('NWND')).toBeNull();
  });
});
