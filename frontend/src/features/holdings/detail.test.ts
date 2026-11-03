import type { AssessmentFacts, SignalData } from '@/api/schema';
import { makeRow } from '@/test/analysisBuilders';

import {
  aiFacts,
  analystFacts,
  cannotSee,
  earningsFact,
  momentumFacts,
  technicalFacts,
} from './detail';

const facts: AssessmentFacts = {
  consensus: 'StrongBuy',
  priceTarget: 212,
  lastPrice: 190.47,
  currency: 'USD',
  streetUpsidePct: 11.3,
  smartScore: 9,
  aiScore: 82,
  aiUpsidePct: 13.6,
  nextEarningsDate: '2026-11-15',
  daysToEarnings: 24,
  analystCount: 31,
};

const signals: SignalData = {
  bestAnalystConsensus: 'Buy',
  peRatio: 31.24,
  dividendYieldPct: 0.7,
  ytdGainPct: 28.4,
  yearlyGainPct: -4.4,
  ai: { score: 82, rating: 'outperform', priceTarget: 214, upsidePct: 13.6, asOf: '2026-10-19' },
  breadth: {
    analysts: 31,
    buy: 24,
    hold: 6,
    sell: 1,
    withPriceTarget: 29,
    priceTargetMin: 160,
    priceTargetMedian: 210,
    priceTargetMax: 250,
  },
  technicalDay: 'Buy',
  technicalWeek: 'StrongBuy',
};

const row = makeRow({ symbol: 'NWND', weightPct: 32, assessment: { facts } });

describe('analystFacts', () => {
  it('reads the consensus, the ratings and where the targets lie', () => {
    expect(analystFacts(row, signals)).toEqual([
      { label: 'Consensus', value: 'Strong Buy' },
      { label: 'Best-ranked analysts', value: 'Buy' },
      { label: 'Ratings', value: '24 Buy · 6 Hold · 1 Sell, 31 analysts in the last 12 months' },
      { label: 'Average price target', value: '$212.00 (+11.3% from the $190.47 price)' },
      { label: 'Target range', value: '$160.00 to $250.00, median $210.00' },
    ]);
  });

  it('falls back on the analyst count before the signals have loaded', () => {
    expect(analystFacts(row, null)).toEqual([
      { label: 'Consensus', value: 'Strong Buy' },
      { label: 'Analysts', value: '31 in the last 12 months' },
      { label: 'Average price target', value: '$212.00 (+11.3% from the $190.47 price)' },
    ]);
  });

  it('says so when there is no price target, and when the analysts cover another listing', () => {
    const thin = makeRow({
      symbol: 'ATROB',
      assessment: {
        viaTicker: 'ATRO',
        facts: { ...facts, priceTarget: null, streetUpsidePct: null, analystCount: 1 },
      },
    });

    const lines = analystFacts(thin, null);

    expect(lines).toContainEqual({
      label: 'Average price target',
      value: 'None: too few analysts have set one.',
    });
    expect(lines).toContainEqual({
      label: 'Covered as',
      value: 'ATRO. TipRanks covers that listing, not this one.',
    });
  });

  it('uses the instrument currency, and none when it is unknown', () => {
    const euro = makeRow({
      symbol: 'SHL.DE',
      assessment: { facts: { ...facts, currency: 'EUR', priceTarget: 120, lastPrice: 100 } },
    });
    const unknown = makeRow({
      symbol: 'XXX',
      assessment: { facts: { ...facts, currency: null, priceTarget: 120, lastPrice: 100 } },
    });

    expect(analystFacts(euro, null)[2].value).toBe('€120.00 (+11.3% from the €100.00 price)');
    expect(analystFacts(unknown, null)[2].value).toBe('120.00 (+11.3% from the 100.00 price)');
  });
});

describe('aiFacts', () => {
  it('gives the score, rating, target and when it was made', () => {
    expect(aiFacts(row, signals)).toEqual([
      { label: 'AI score', value: '82/100, outperform' },
      { label: 'AI price target', value: '$214.00 (+13.6%)' },
      { label: 'As of', value: '19 Oct 2026' },
    ]);
  });

  it('keeps the score and upside from the analysis while the signals load', () => {
    expect(aiFacts(row, null)).toEqual([
      { label: 'AI score', value: '82/100' },
      { label: 'AI upside', value: '+13.6%' },
    ]);
  });

  it('is empty when TipRanks has no AI analysis', () => {
    const none = makeRow({
      symbol: 'FRTH',
      assessment: { facts: { ...facts, aiScore: null, aiUpsidePct: null } },
    });

    expect(aiFacts(none, null)).toEqual([]);
  });
});

describe('technicalFacts', () => {
  it('reads the trend on the day and the week', () => {
    expect(technicalFacts(signals)).toEqual([
      { label: 'Day', value: 'Buy' },
      { label: 'Week', value: 'Strong Buy' },
    ]);
  });

  it('leaves out what is missing', () => {
    expect(technicalFacts({ technicalWeek: 'Sell' })).toEqual([{ label: 'Week', value: 'Sell' }]);
    expect(technicalFacts(null)).toEqual([]);
    expect(technicalFacts({})).toEqual([]);
  });
});

describe('momentumFacts', () => {
  it('lists the price, the moves and the valuation that TipRanks reported', () => {
    expect(momentumFacts(signals, facts)).toEqual([
      { label: 'Last price', value: '$190.47' },
      { label: 'Year to date', value: '+28.4%' },
      { label: 'Past year', value: '\u22124.4%' },
      { label: 'Price/earnings', value: '31.2' },
      { label: 'Dividend yield', value: '0.70%' },
    ]);
  });

  it('lists nothing it was not told', () => {
    expect(momentumFacts(null, { ...facts, lastPrice: null })).toEqual([]);
    expect(momentumFacts({ ytdGainPct: 0 }, { ...facts, lastPrice: null })).toEqual([
      { label: 'Year to date', value: '0.0%' },
    ]);
  });
});

describe('earningsFact', () => {
  it.each([
    [24, '15 Nov 2026, in 24 days'],
    [1, '15 Nov 2026, tomorrow'],
    [0, '15 Nov 2026, today'],
    [-2, '15 Nov 2026'],
    [null, '15 Nov 2026'],
  ])('with %s days to go it reads "%s"', (days, expected) => {
    expect(earningsFact({ ...facts, daysToEarnings: days })).toEqual({
      label: 'Next earnings',
      value: expected,
    });
  });

  it('is nothing when no date is known', () => {
    expect(earningsFact({ ...facts, nextEarningsDate: null })).toBeNull();
  });
});

describe('cannotSee', () => {
  it('sizes the position against the account, and names what the data does not know', () => {
    const lines = cannotSee(row);

    expect(lines[0]).toContain('This one is 32.0% of the account');
    expect(lines[0]).toContain('a 10% move in it is about 3.2% of the account');
    expect(lines).toHaveLength(3);
    expect(lines.join(' ')).toContain('tax');
  });
});
