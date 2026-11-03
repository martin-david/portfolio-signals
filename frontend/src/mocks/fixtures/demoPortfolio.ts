/**
 * A FICTIONAL portfolio for the demo API. The companies are made-up names (several borrowed from Microsoft's sample
 * companies), the numbers are invented and none of it is real market data, analyst content or anyone's positions.
 * The raw signals go through the scorer port, so every verdict and flag is derived, not typed in.
 */
import type { AccountSummary, CopiedTrader, HoldingDto, SignalData } from '@/api/schema';

export interface DemoHolding {
  holding: HoldingDto;
  /** Sibling listings whose signals stand in when the primary ticker has none. */
  related: string[];
  /** Signals by TipRanks ticker: the primary one first, then the related ones. */
  signals: Record<string, SignalData>;
}

export interface DemoData {
  account: AccountSummary;
  holdings: DemoHolding[];
  copiedTraders: CopiedTrader[];
}

const DAY = 86_400_000;

function inDays(now: Date, days: number): string {
  return new Date(now.getTime() + days * DAY).toISOString().slice(0, 10);
}

/**
 * A reporting day: companies do not report at weekends, so a date that falls on one moves back to the Friday before.
 * Moving back keeps each holding on its side of the 30-day and 70-day lines that the demo's findings are built on.
 */
function reportingDay(now: Date, days: number): string {
  const weekday = new Date(now.getTime() + days * DAY).getUTCDay();
  const back = weekday === 6 ? 1 : weekday === 0 ? 2 : 0;
  return inDays(now, days - back);
}

function breadth(
  analysts: number,
  buy: number,
  hold: number,
  sell: number,
  withTargets: number,
  min: number,
  median: number,
  max: number,
) {
  return {
    analysts,
    buy,
    hold,
    sell,
    withPriceTarget: withTargets,
    priceTargetMin: min,
    priceTargetMedian: median,
    priceTargetMax: max,
  };
}

function ai(score: number, rating: string, target: number, upsidePct: number, now: Date) {
  return { score, rating, priceTarget: target, upsidePct, asOf: inDays(now, -3) };
}

type Spec = {
  id: number;
  symbol: string;
  name: string;
  assetClass?: HoldingDto['assetClass'];
  tipRanksTicker?: string;
  related?: string[];
  value: number;
  pnlPct: number;
  price: number | null;
  signals?: Record<string, SignalData>;
};

const CASH = 5300;

export function createDemoData(now: Date, drift = 0): DemoData {
  const d = (days: number) => reportingDay(now, days);
  const scale = 1 + drift;

  const specs: Spec[] = [
    {
      id: 1001,
      symbol: 'NWND',
      name: 'Northwind Systems',
      value: 47800,
      pnlPct: 41,
      price: 188.4,
      signals: {
        NWND: {
          companyName: 'Northwind Systems',
          sector: 'Technology',
          consensus: 'StrongBuy',
          bestAnalystConsensus: 'StrongBuy',
          priceTarget: 212,
          lastPrice: 188.4,
          currency: 'USD',
          smartScore: 9,
          peRatio: 31.2,
          dividendYieldPct: 0.7,
          newsSentiment: 0.62,
          hedgeFundsScore: 0.64,
          insiderScore: 0.58,
          ytdGainPct: 28.4,
          yearlyGainPct: 44.1,
          nextEarningsDate: d(24),
          ai: ai(82, 'outperform', 214, 13.6, now),
          breadth: breadth(31, 24, 6, 1, 29, 160, 210, 250),
          technicalDay: 'Buy',
          technicalWeek: 'StrongBuy',
        },
      },
    },
    {
      id: 1002,
      symbol: 'CTSO',
      name: 'Contoso Cloud',
      value: 21600,
      pnlPct: 18,
      price: 301,
      signals: {
        CTSO: {
          companyName: 'Contoso Cloud',
          sector: 'Technology',
          consensus: 'StrongBuy',
          bestAnalystConsensus: 'Buy',
          priceTarget: 330,
          lastPrice: 301,
          currency: 'USD',
          smartScore: 8,
          peRatio: 27.8,
          dividendYieldPct: 0,
          newsSentiment: 0.41,
          hedgeFundsScore: 0.52,
          insiderScore: 0.4,
          ytdGainPct: 14.2,
          yearlyGainPct: 22.5,
          nextEarningsDate: d(24),
          ai: ai(74, 'outperform', 325, 8, now),
          breadth: breadth(27, 20, 6, 1, 25, 270, 328, 380),
          technicalDay: 'Neutral',
          technicalWeek: 'Buy',
        },
      },
    },
    {
      id: 1003,
      symbol: 'FBRK',
      name: 'Fabrikam Foods',
      value: 14900,
      pnlPct: 6,
      price: 95.2,
      signals: {
        FBRK: {
          companyName: 'Fabrikam Foods',
          sector: 'Consumer Staples',
          consensus: 'StrongBuy',
          bestAnalystConsensus: 'StrongBuy',
          priceTarget: 96,
          lastPrice: 95.2,
          currency: 'USD',
          smartScore: 8,
          peRatio: 21.4,
          dividendYieldPct: 2.1,
          newsSentiment: 0.22,
          hedgeFundsScore: 0.35,
          insiderScore: 0.5,
          ytdGainPct: 9.8,
          yearlyGainPct: 12.7,
          nextEarningsDate: d(9),
          ai: ai(70, 'outperform', 98, 2.9, now),
          breadth: breadth(24, 20, 4, 0, 22, 85, 96, 108),
          technicalDay: 'Buy',
          technicalWeek: 'Buy',
        },
      },
    },
    {
      id: 1004,
      symbol: 'ADWK',
      name: 'Adventure Works Outdoors',
      value: 11250,
      pnlPct: -8,
      price: 104,
      signals: {
        ADWK: {
          companyName: 'Adventure Works Outdoors',
          sector: 'Consumer Discretionary',
          consensus: 'Buy',
          bestAnalystConsensus: 'Neutral',
          priceTarget: 120,
          lastPrice: 104,
          currency: 'USD',
          smartScore: 6,
          peRatio: 18.9,
          dividendYieldPct: 1.4,
          newsSentiment: -0.12,
          hedgeFundsScore: 0.3,
          insiderScore: 0.45,
          ytdGainPct: -6.1,
          yearlyGainPct: -9.4,
          nextEarningsDate: d(38),
          ai: ai(52, 'neutral', 93.6, -10, now),
          breadth: breadth(19, 11, 5, 3, 17, 80, 118, 150),
          technicalDay: 'Sell',
          technicalWeek: 'Neutral',
        },
      },
    },
    {
      id: 1005,
      symbol: 'TLSP',
      name: 'Tailspin Mobility',
      value: 9300,
      pnlPct: -46,
      price: 17.2,
      signals: {
        TLSP: {
          companyName: 'Tailspin Mobility',
          sector: 'Industrials',
          consensus: 'Sell',
          bestAnalystConsensus: 'Sell',
          priceTarget: 14,
          lastPrice: 17.2,
          currency: 'USD',
          smartScore: 3,
          peRatio: null,
          dividendYieldPct: 0,
          newsSentiment: -0.48,
          hedgeFundsScore: 0.12,
          insiderScore: 0.2,
          ytdGainPct: -33.5,
          yearlyGainPct: -52.3,
          nextEarningsDate: d(52),
          ai: ai(33, 'underperform', 12, -30, now),
          breadth: breadth(16, 3, 4, 9, 14, 8, 14, 22),
          technicalDay: 'Sell',
          technicalWeek: 'Sell',
        },
      },
    },
    {
      id: 1006,
      symbol: 'WGTP',
      name: 'Woodgrove Financial',
      value: 8100,
      pnlPct: 22,
      price: 66,
      signals: {
        WGTP: {
          companyName: 'Woodgrove Financial',
          sector: 'Financials',
          consensus: 'StrongBuy',
          bestAnalystConsensus: 'StrongBuy',
          priceTarget: 74,
          lastPrice: 66,
          currency: 'USD',
          smartScore: 9,
          peRatio: 12.6,
          dividendYieldPct: 3.2,
          newsSentiment: 0.33,
          hedgeFundsScore: 0.4,
          insiderScore: 0.7,
          ytdGainPct: 17.9,
          yearlyGainPct: 26.4,
          nextEarningsDate: d(24),
          ai: ai(80, 'outperform', 75, 13.6, now),
          breadth: breadth(18, 15, 3, 0, 16, 62, 73, 85),
          technicalDay: 'Buy',
          technicalWeek: 'Buy',
        },
      },
    },
    {
      id: 1007,
      symbol: 'WWIM.DE',
      name: 'Wide World Importers AG',
      tipRanksTicker: 'DE:WWIM',
      value: 6400,
      pnlPct: 12,
      price: 131,
      signals: {
        'DE:WWIM': {
          companyName: 'Wide World Importers AG',
          sector: 'Industrials',
          consensus: 'Buy',
          bestAnalystConsensus: 'Buy',
          priceTarget: 142,
          lastPrice: 131,
          currency: 'EUR',
          smartScore: 7,
          peRatio: 16.3,
          dividendYieldPct: 2.6,
          newsSentiment: 0.15,
          hedgeFundsScore: 0.3,
          insiderScore: 0.4,
          ytdGainPct: 8.2,
          yearlyGainPct: 11.9,
          nextEarningsDate: d(61),
          ai: ai(66, 'neutral', 140, 6.9, now),
          breadth: breadth(12, 8, 3, 1, 10, 115, 141, 165),
          technicalDay: 'Neutral',
          technicalWeek: 'Buy',
        },
      },
    },
    {
      id: 1008,
      symbol: 'ALPSB',
      name: 'Alpine Ski House Class B',
      related: ['ALPS'],
      value: 4700,
      pnlPct: 9,
      price: 36.5,
      signals: {
        ALPSB: {},
        ALPS: {
          companyName: 'Alpine Ski House',
          sector: 'Consumer Discretionary',
          consensus: 'StrongBuy',
          priceTarget: 45,
          lastPrice: 38,
          currency: 'USD',
          nextEarningsDate: d(47),
          breadth: breadth(9, 7, 2, 0, 8, 38, 45, 54),
        },
      },
    },
    {
      id: 1009,
      symbol: 'LTWR',
      name: 'Litware Health',
      value: 3900,
      pnlPct: -15,
      price: 51.3,
      signals: {
        LTWR: {
          companyName: 'Litware Health',
          sector: 'Health Care',
          consensus: 'Neutral',
          bestAnalystConsensus: 'Neutral',
          priceTarget: 56,
          lastPrice: 51.3,
          currency: 'USD',
          smartScore: 7,
          peRatio: 24.1,
          dividendYieldPct: 0,
          newsSentiment: -0.05,
          hedgeFundsScore: 0.25,
          insiderScore: 0.3,
          ytdGainPct: -4.4,
          yearlyGainPct: -11.2,
          nextEarningsDate: d(33),
          ai: ai(66, 'neutral', 55, 7.2, now),
          breadth: breadth(3, 1, 2, 0, 3, 50, 56, 60),
          technicalDay: 'Neutral',
          technicalWeek: 'Neutral',
        },
      },
    },
    {
      id: 1010,
      symbol: 'BYAL',
      name: 'Blue Yonder Airlines',
      value: 2800,
      pnlPct: 27,
      price: 29.5,
      signals: {
        BYAL: {
          companyName: 'Blue Yonder Airlines',
          sector: 'Industrials',
          consensus: 'Buy',
          bestAnalystConsensus: 'Buy',
          priceTarget: 33,
          lastPrice: 29.5,
          currency: 'USD',
          smartScore: 7,
          peRatio: 9.7,
          dividendYieldPct: 0,
          newsSentiment: 0.1,
          hedgeFundsScore: 0.35,
          insiderScore: 0.25,
          ytdGainPct: 21.3,
          yearlyGainPct: 30.8,
          nextEarningsDate: d(6),
          ai: ai(63, 'neutral', 32, 8.5, now),
          breadth: breadth(14, 11, 2, 1, 12, 24, 33, 42),
          technicalDay: 'Buy',
          technicalWeek: 'Neutral',
        },
      },
    },
    {
      id: 1011,
      symbol: 'PRSW',
      name: 'Proseware Robotics',
      value: 1650,
      pnlPct: 64,
      price: 74.8,
      signals: {
        PRSW: {
          companyName: 'Proseware Robotics',
          sector: 'Technology',
          consensus: 'StrongBuy',
          bestAnalystConsensus: 'StrongBuy',
          priceTarget: 92,
          lastPrice: 74.8,
          currency: 'USD',
          smartScore: 8,
          peRatio: 38.4,
          dividendYieldPct: 0,
          newsSentiment: 0.5,
          hedgeFundsScore: 0.55,
          insiderScore: 0.45,
          ytdGainPct: 52.7,
          yearlyGainPct: 71.9,
          nextEarningsDate: d(40),
          ai: ai(77, 'outperform', 90, 20.3, now),
          breadth: breadth(11, 9, 2, 0, 10, 70, 90, 110),
          technicalDay: 'Buy',
          technicalWeek: 'StrongBuy',
        },
      },
    },
    {
      id: 1012,
      symbol: 'COHO',
      name: 'Coho Winery',
      value: 780,
      pnlPct: 3,
      price: 14.2,
      signals: {
        COHO: {
          companyName: 'Coho Winery',
          sector: 'Consumer Staples',
          consensus: 'Buy',
          priceTarget: 16.5,
          lastPrice: 14.2,
          currency: 'USD',
          smartScore: 7,
          dividendYieldPct: 1.8,
          nextEarningsDate: d(66),
          ai: ai(64, 'neutral', 16, 12.7, now),
          breadth: breadth(8, 6, 2, 0, 7, 13, 16.5, 20),
          technicalDay: 'Buy',
          technicalWeek: 'Buy',
        },
      },
    },
    {
      id: 1013,
      symbol: 'TREY',
      name: 'Trey Research Index Fund',
      assetClass: 'Etf',
      value: 640,
      pnlPct: 11,
      price: 52,
    },
    {
      id: 1014,
      symbol: 'FRTH',
      name: 'Fourth Coffee',
      value: 410,
      pnlPct: -12,
      price: 8.9,
      signals: {
        FRTH: {
          companyName: 'Fourth Coffee',
          sector: 'Consumer Discretionary',
          consensus: 'Buy',
          priceTarget: 11,
          lastPrice: 8.9,
          currency: 'USD',
          smartScore: 6,
          nextEarningsDate: d(29),
          breadth: breadth(1, 1, 0, 0, 1, 11, 11, 11),
        },
      },
    },
    {
      id: 100001,
      symbol: 'ORBT',
      name: 'Orbit Coin',
      assetClass: 'Crypto',
      tipRanksTicker: 'ORBTUSD',
      value: 520,
      pnlPct: -31,
      price: 0.42,
    },
  ];

  const holdings: DemoHolding[] = specs.map((spec) => {
    const value = Math.round(spec.value * scale);
    const invested = Math.round(spec.value / (1 + spec.pnlPct / 100));
    const price = (spec.price ?? 100) * scale;
    const signals = Object.fromEntries(
      Object.entries(spec.signals ?? {}).map(([ticker, data]) => [
        ticker,
        data.lastPrice != null
          ? { ...data, lastPrice: Math.round(data.lastPrice * scale * 100) / 100 }
          : data,
      ]),
    );
    return {
      holding: {
        instrumentId: spec.id,
        symbol: spec.symbol,
        name: spec.name,
        assetClass: spec.assetClass ?? 'Stock',
        tipRanksTicker: spec.tipRanksTicker ?? spec.symbol,
        invested,
        value,
        weightPct: 0,
        pnl: value - invested,
        pnlPct: Math.round(((value - invested) / invested) * 1000) / 10,
        units: Math.round((value / price) * 10_000) / 10_000,
        avgOpenRate: Math.round((invested / (value / price)) * 100) / 100,
        avgLeverage: 1,
      },
      related: spec.related ?? [],
      signals,
    };
  });

  const copiedTraders: CopiedTrader[] = [
    {
      mirrorId: 904211,
      invested: 4200,
      value: Math.round(5100 * scale),
      openPnl: 900,
      openPnlPct: 21.4,
      closedPnl: 120,
      availableCash: 80,
      valuePct: 0,
      stopLossPct: 40,
    },
    {
      mirrorId: 904377,
      invested: 4000,
      value: Math.round(4300 * scale),
      openPnl: 300,
      openPnlPct: 7.5,
      closedPnl: -45,
      availableCash: 60,
      valuePct: 0,
      stopLossPct: 35,
    },
  ];

  const directValue = holdings.reduce((sum, h) => sum + h.holding.value, 0);
  const copiedValue = copiedTraders.reduce((sum, c) => sum + c.value, 0);
  const totalValue = directValue + copiedValue + CASH;
  const account: AccountSummary = {
    currency: 'USD',
    totalValue,
    directValue,
    copiedValue,
    availableCash: CASH,
    unrealizedPnl:
      holdings.reduce((sum, h) => sum + h.holding.pnl, 0) +
      copiedTraders.reduce((sum, c) => sum + c.openPnl, 0),
    usedMargin: 0,
  };

  return {
    account,
    holdings: holdings.map((h) => ({
      ...h,
      holding: {
        ...h.holding,
        weightPct: Math.round((h.holding.value / totalValue) * 1_000_000) / 10_000,
      },
    })),
    copiedTraders: copiedTraders.map((c) => ({
      ...c,
      valuePct: Math.round((c.value / totalValue) * 10_000) / 100,
    })),
  };
}
