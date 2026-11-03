import { makeRow } from '@/test/analysisBuilders';
import { loadDemo } from '@/test/demo';

import {
  DEFAULT_SORT,
  ariaSortOf,
  describeSort,
  filterCounts,
  filterHoldings,
  nextSort,
  sortHint,
  sortHoldings,
} from './panel';

const rows = [
  makeRow({ symbol: 'BIG', verdict: 'HoldReviewSize', weightPct: 30, composite: 70, pnlPct: 40 }),
  makeRow({ symbol: 'MID', verdict: 'Watch', weightPct: 12, composite: 20, pnlPct: -8 }),
  makeRow({ symbol: 'LOW', verdict: 'Review', weightPct: 6, composite: -30, pnlPct: -46 }),
  makeRow({ symbol: 'TNY', verdict: 'Hold', weightPct: 0.4, composite: 55, pnlPct: 3 }),
  makeRow({ symbol: 'CRY', verdict: 'NoData', weightPct: 0.3, composite: null, pnlPct: -31 }),
];

const symbols = (list: typeof rows) => list.map((row) => row.holding.symbol);

describe('filterHoldings', () => {
  it('keeps everything, the positions above 1%, or the ones to watch or review', () => {
    expect(symbols(filterHoldings(rows, 'all'))).toHaveLength(5);
    expect(symbols(filterHoldings(rows, 'material'))).toEqual(['BIG', 'MID', 'LOW']);
    expect(symbols(filterHoldings(rows, 'attention'))).toEqual(['MID', 'LOW']);
  });

  it('counts each filter for its chip', () => {
    expect(filterCounts(rows)).toEqual({ all: 5, material: 3, attention: 2 });
  });

  it('does not change the rows it is given', () => {
    const before = symbols(rows);
    filterHoldings(rows, 'attention');
    sortHoldings(rows, { key: 'pnl', direction: 'asc' });
    expect(symbols(rows)).toEqual(before);
  });
});

describe('sortHoldings', () => {
  it('opens with the largest positions first', () => {
    expect(DEFAULT_SORT).toEqual({ key: 'weight', direction: 'desc' });
    expect(symbols(sortHoldings(rows, DEFAULT_SORT))).toEqual(['BIG', 'MID', 'LOW', 'TNY', 'CRY']);
  });

  it('sorts by verdict in the report order', () => {
    expect(symbols(sortHoldings(rows, { key: 'verdict', direction: 'asc' }))).toEqual([
      'BIG',
      'TNY',
      'MID',
      'LOW',
      'CRY',
    ]);
    expect(symbols(sortHoldings(rows, { key: 'verdict', direction: 'desc' }))).toEqual([
      'CRY',
      'LOW',
      'MID',
      'TNY',
      'BIG',
    ]);
  });

  it('sorts by score and always puts rows without a score last', () => {
    expect(symbols(sortHoldings(rows, { key: 'score', direction: 'desc' }))).toEqual([
      'BIG',
      'TNY',
      'MID',
      'LOW',
      'CRY',
    ]);
    expect(symbols(sortHoldings(rows, { key: 'score', direction: 'asc' }))).toEqual([
      'LOW',
      'MID',
      'TNY',
      'BIG',
      'CRY',
    ]);
  });

  it('sorts by result against cost', () => {
    expect(symbols(sortHoldings(rows, { key: 'pnl', direction: 'desc' }))).toEqual([
      'BIG',
      'TNY',
      'MID',
      'CRY',
      'LOW',
    ]);
  });

  it('breaks ties by weight', () => {
    const tied = [
      makeRow({ symbol: 'A', verdict: 'Hold', weightPct: 5 }),
      makeRow({ symbol: 'B', verdict: 'Hold', weightPct: 9 }),
    ];
    expect(symbols(sortHoldings(tied, { key: 'verdict', direction: 'asc' }))).toEqual(['B', 'A']);
    const unscored = [
      makeRow({ symbol: 'A', verdict: 'NoData', weightPct: 5 }),
      makeRow({ symbol: 'B', verdict: 'NoData', weightPct: 9 }),
    ];
    expect(symbols(sortHoldings(unscored, { key: 'score', direction: 'desc' }))).toEqual([
      'B',
      'A',
    ]);
  });

  it('sorts the demo portfolio by every column without losing a row', async () => {
    const { analysis } = await loadDemo();

    for (const key of ['weight', 'verdict', 'score', 'pnl'] as const) {
      for (const direction of ['asc', 'desc'] as const) {
        expect(sortHoldings(analysis.holdings, { key, direction })).toHaveLength(15);
      }
    }
  });
});

describe('nextSort', () => {
  it('starts a column the way it is read and flips it on the second click', () => {
    let sort = nextSort(DEFAULT_SORT, 'verdict');
    expect(sort).toEqual({ key: 'verdict', direction: 'asc' });
    sort = nextSort(sort, 'verdict');
    expect(sort).toEqual({ key: 'verdict', direction: 'desc' });
    sort = nextSort(sort, 'score');
    expect(sort).toEqual({ key: 'score', direction: 'desc' });
    expect(nextSort(DEFAULT_SORT, 'weight')).toEqual({ key: 'weight', direction: 'asc' });
  });

  it('reports the sort state of each column for assistive technology', () => {
    const sort = { key: 'score', direction: 'asc' } as const;
    expect(ariaSortOf(sort, 'score')).toBe('ascending');
    expect(ariaSortOf({ key: 'score', direction: 'desc' }, 'score')).toBe('descending');
    expect(ariaSortOf(sort, 'weight')).toBe('none');
  });
});

describe('describeSort', () => {
  it.each([
    [{ key: 'weight', direction: 'desc' }, 'Weight, largest first'],
    [{ key: 'weight', direction: 'asc' }, 'Weight, smallest first'],
    [{ key: 'verdict', direction: 'asc' }, 'Verdict, holds first'],
    [{ key: 'verdict', direction: 'desc' }, 'Verdict, no data first'],
    [{ key: 'score', direction: 'desc' }, 'Score, highest first'],
    [{ key: 'score', direction: 'asc' }, 'Score, lowest first'],
    [{ key: 'pnl', direction: 'desc' }, 'Result vs your cost, best first'],
    [{ key: 'pnl', direction: 'asc' }, 'Result vs your cost, worst first'],
  ] as const)('puts %j in words as "%s"', (sort, words) => {
    expect(describeSort(sort)).toBe(words);
  });

  it('says what the next press of a column will do', () => {
    expect(sortHint(DEFAULT_SORT, 'weight')).toBe('Sort by weight, smallest first');
    expect(sortHint(DEFAULT_SORT, 'verdict')).toBe('Sort by verdict, holds first');
  });
});
