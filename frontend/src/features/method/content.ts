import type { FlagSeverity, Tier, Verdict } from '@/api/schema';

/**
 * What the Method page says, as data. It restates the rules of the backend's HoldingScorer, and the tests hold the
 * thresholds here against the scorer the demo runs on, so a rule that changes there has to change here too.
 */

/** From this share of the account a holding is material: the headline and the "Above 1%" filter count only those. */
export const MATERIAL_PCT = 1;

/** From this share a strong Hold is marked "Hold · size", and the concentration flag is an Alert. */
export const LARGE_POSITION_PCT = 25;

/** From this share the concentration flag is a Warning. */
export const BIG_POSITION_PCT = 10;

export interface SignalRule {
  name: string;
  source: string;
  scale: string;
}

export const SIGNAL_RULES: readonly SignalRule[] = [
  {
    name: 'Consensus',
    source: 'The consensus rating of the analysts TipRanks tracks',
    scale: 'Strong Sell \u22121, Sell \u22120.5, Neutral 0, Buy +0.5, Strong Buy +1.',
  },
  {
    name: 'Target upside',
    source: 'The average analyst price target against the last price',
    scale:
      'Upside divided by 30%, limited to \u22121 and +1. Left out when fewer than 3 analysts have set a target.',
  },
  {
    name: 'Smart Score',
    source: 'TipRanks Smart Score, 1 to 10',
    scale: '(score \u2212 5.5) \u00f7 4.5, so 10 is +1 and 1 is \u22121.',
  },
  {
    name: 'AI models',
    source: 'TipRanks\u2019 own language-model analysis, 0 to 100',
    scale: '(score \u2212 60) \u00f7 25, limited to \u22121 and +1.',
  },
  {
    name: 'Technical trend',
    source: 'TipRanks technical summaries for the day and the week',
    scale: 'The average of the two on the consensus scale.',
  },
  {
    name: 'Analyst breadth',
    source: 'The latest rating of each analyst in the last 12 months',
    scale: '(Buy \u2212 Sell) \u00f7 analysts. Left out when fewer than 5 analysts rated.',
  },
];

export const SCORE_RULE =
  'The score is the average of the signals that exist for a holding, times 100. A signal that is missing is skipped, never counted as zero.';

export const SIGNALS_NOT_YET =
  'Two of the six are not always there. TipRanks\u2019 technical summaries are not fetched yet, and analyst breadth needs a TipRanks call for every holding, so it is off by default.';

export const WEIGHTS_NOTE =
  'The weights are equal by design. The score has not been tested for predictive power.';

export interface VerdictOutcome {
  verdict: Verdict;
  /** The condition for this verdict within the tier. Empty when the tier always ends in it. */
  when: string;
}

export interface TierRule {
  tier: Tier;
  /** The lowest score of the tier. Null for the weakest tier and for holdings without a score. */
  from: number | null;
  range: string;
  outcomes: readonly VerdictOutcome[];
}

export const TIER_RULES: readonly TierRule[] = [
  {
    tier: 'Strong',
    from: 60,
    range: '60 and up',
    outcomes: [
      { verdict: 'Hold', when: `below ${LARGE_POSITION_PCT}% of the account` },
      { verdict: 'HoldReviewSize', when: `${LARGE_POSITION_PCT}% of the account or more` },
    ],
  },
  {
    tier: 'Supported',
    from: 35,
    range: '35 to 59',
    outcomes: [
      {
        verdict: 'Hold',
        when: 'fewer than two warnings, and the price is not at its average target',
      },
      {
        verdict: 'Watch',
        when: 'two or more warnings, or the price is at its average target',
      },
    ],
  },
  {
    tier: 'Mixed',
    from: 10,
    range: '10 to 34',
    outcomes: [
      { verdict: 'Watch', when: 'fewer than three warnings' },
      { verdict: 'Review', when: 'three or more warnings' },
    ],
  },
  {
    tier: 'Weak',
    from: null,
    range: 'below 10',
    outcomes: [{ verdict: 'Review', when: '' }],
  },
  {
    tier: 'NoData',
    from: null,
    range: 'no score',
    outcomes: [
      {
        verdict: 'NoData',
        when: 'funds, crypto and anything else that is not a single stock, and stocks TipRanks has sent nothing about',
      },
    ],
  },
];

export const REVIEW_NOTE =
  'Review means the data gives a reason to look again. It is not a sell signal.';

export const MATERIAL_NOTE = `Holdings below ${MATERIAL_PCT}% of the account are scored too, but they stay out of the headline and the \u201cAbove\u00a0${MATERIAL_PCT}%\u201d filter.`;

export interface FlagRule {
  /** The key the API gives the flag. */
  key: string;
  title: string;
  /** What it takes for the flag to appear. */
  rule: string;
  /** The severities the rule can give, most serious first. */
  severities: readonly FlagSeverity[];
}

export const FLAG_RULES: readonly FlagRule[] = [
  {
    key: 'concentration',
    title: 'Large single position',
    rule: `${LARGE_POSITION_PCT}% of the account or more is an Alert. ${BIG_POSITION_PCT}% or more is a Warning.`,
    severities: ['Alert', 'Warn'],
  },
  {
    key: 'priced_at_target',
    title: 'Trades at its average analyst target',
    rule: 'The average target is less than 3% above the price, or below it. Not raised when fewer than 3 analysts have set a target.',
    severities: ['Warn'],
  },
  {
    key: 'dispersion',
    title: 'Street and AI targets disagree',
    rule: 'The upside to the Street\u2019s average target is 25 points or more above the upside the AI models see.',
    severities: ['Warn'],
  },
  {
    key: 'weak_consensus',
    title: 'Weak analyst consensus',
    rule: 'The consensus is Neutral, Sell or Strong Sell.',
    severities: ['Warn'],
  },
  {
    key: 'thin_coverage',
    title: 'Thin coverage',
    rule: 'Fewer than 5 analysts rated the stock in the last 12 months.',
    severities: ['Warn'],
  },
  {
    key: 'weak_trend',
    title: 'Negative technical trend',
    rule: 'The day and week summaries lean Sell on average.',
    severities: ['Warn'],
  },
  {
    key: 'deep_loss',
    title: 'Deep loss against your cost',
    rule: 'Down 40% or more against your cost. A Warning when the score is below 35, otherwise Info.',
    severities: ['Warn', 'Info'],
  },
  {
    key: 'earnings_soon',
    title: 'Earnings soon',
    rule: 'The next report is within 30 days.',
    severities: ['Info'],
  },
  {
    key: 'year_decline',
    title: 'Weak year',
    rule: 'Down 25% or more over 12 months.',
    severities: ['Info'],
  },
  {
    key: 'not_synced',
    title: 'No analyst data yet',
    rule: 'A stock that has not been through a TipRanks sync yet. It has no score.',
    severities: ['Info'],
  },
  {
    key: 'no_coverage',
    title: 'No analyst coverage',
    rule: 'Crypto, funds and anything else that is not a single stock. It has no score.',
    severities: ['Info'],
  },
];

export const WARNING_NOTE =
  'A warning is a flag of severity Warning or Alert. The verdict rules count warnings; Info flags are context only.';

export const WHAT_IS_MISSING: readonly string[] = [
  'Your tax position, time horizon, risk tolerance and other assets.',
  'TipRanks data for copy trading, funds and crypto. Copy trading shows in the account strip as not assessed; funds and crypto are marked No data.',
  'The bull and bear case, the latest catalyst, deep fundamentals, the macro calendar and dividend history. The API does not provide them yet, and the app does not make them up.',
  'Trading and rebalancing. The app reads your eToro account and never places an order.',
];

export const SOURCES =
  'Positions, cost and cash come from your eToro account through its public API, read-only, with your own keys. Analyst data comes from TipRanks through its MCP server, with your own key. TipRanks\u2019 free plan allows about 50 tool calls a month and 10 a minute, so data can lag and a sync can be rate limited. The app says so when it happens.';

export const DISCLAIMER =
  'This is informational and is not investment advice. Analyst ratings, Smart Scores and AI scores are opinions or model outputs and can be wrong, and past performance does not predict future results.';
