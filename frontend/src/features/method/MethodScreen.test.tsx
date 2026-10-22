import { fireEvent, screen, waitFor, within } from 'expo-router/testing-library';

import { severityMeta, tierLabel, verdictMeta } from '@/features/portfolio/verdicts';
import { renderRouted } from '@/test/renderRouted';
import { setWindowWidth } from '@/test/window';

import {
  DISCLAIMER,
  FLAG_RULES,
  MATERIAL_NOTE,
  REVIEW_NOTE,
  SCORE_RULE,
  SIGNALS_NOT_YET,
  SIGNAL_RULES,
  SOURCES,
  TIER_RULES,
  WARNING_NOTE,
  WEIGHTS_NOTE,
  WHAT_IS_MISSING,
} from './content';
import { MethodScreen } from './MethodScreen';

// The first render of the router is slow.
jest.setTimeout(30_000);
const LONG = { timeout: 10_000 };

afterEach(() => {
  jest.restoreAllMocks();
});

async function renderMethod() {
  const rendered = await renderRouted(MethodScreen);
  await screen.findByRole('header', { name: 'Method' }, LONG);
  return rendered;
}

describe('the Method page', () => {
  it('goes through how a verdict is made, in order', async () => {
    await renderMethod();

    expect(screen.getAllByRole('header').map((heading) => heading.props.children)).toEqual([
      'Method',
      'Six signals, equal weight',
      'From score to verdict',
      'What the rules look for',
      'What is missing',
      'Sources and limits',
    ]);
  });

  it('tabulates the six signals with where each comes from and how it is scaled', async () => {
    await renderMethod();

    for (const label of ['Signal', 'Source', 'Scaled to \u22121 \u2026 +1']) {
      expect(within(screen.getByTestId('signals')).getByText(label)).toBeOnTheScreen();
    }
    expect(SIGNAL_RULES).toHaveLength(6);
    for (const rule of SIGNAL_RULES) {
      const row = within(screen.getByTestId(`signals-${rule.name}`));
      expect(row.getByText(rule.name)).toBeOnTheScreen();
      expect(row.getByText(rule.source)).toBeOnTheScreen();
      expect(row.getByText(rule.scale)).toBeOnTheScreen();
    }
  });

  it('says how the signals become a score, and what the weights are worth', async () => {
    await renderMethod();

    expect(screen.getByTestId('score-rule')).toHaveTextContent(SCORE_RULE);
    expect(screen.getByText(SIGNALS_NOT_YET)).toBeOnTheScreen();
    expect(screen.getByText(WEIGHTS_NOTE)).toBeOnTheScreen();
  });

  it('shows each tier with its score and the verdicts it leads to, as the chips show them', async () => {
    await renderMethod();

    expect(within(screen.getByTestId('tiers')).getByText('Tier')).toBeOnTheScreen();
    for (const rule of TIER_RULES) {
      const row = within(screen.getByTestId(`tiers-${rule.tier}`));
      expect(row.getByText(tierLabel(rule.tier))).toBeOnTheScreen();
      expect(row.getByText(rule.range)).toBeOnTheScreen();
      for (const outcome of rule.outcomes) {
        expect(row.getByText(verdictMeta[outcome.verdict].label)).toBeOnTheScreen();
        if (outcome.when) {
          expect(row.getByText(outcome.when)).toBeOnTheScreen();
        }
      }
    }
  });

  it('says that Review is not a sell signal, and what counts as material', async () => {
    await renderMethod();

    expect(screen.getByTestId('review-note')).toHaveTextContent(REVIEW_NOTE);
    expect(REVIEW_NOTE).toMatch(/not a sell signal/);
    expect(screen.getByText(MATERIAL_NOTE)).toBeOnTheScreen();
  });

  it('lists every flag with when it appears and how serious it is, in a word as well as a glyph', async () => {
    await renderMethod();

    for (const rule of FLAG_RULES) {
      const row = within(screen.getByTestId(`flags-reference-${rule.key}`));
      expect(row.getByText(rule.title)).toBeOnTheScreen();
      expect(row.getByText(rule.rule)).toBeOnTheScreen();
      for (const severity of rule.severities) {
        expect(row.getByText(severityMeta[severity].label)).toBeOnTheScreen();
      }
    }
    expect(screen.getByText(WARNING_NOTE)).toBeOnTheScreen();
  });

  it('is plain about what it cannot see and where its data comes from', async () => {
    await renderMethod();

    for (const item of WHAT_IS_MISSING) {
      expect(screen.getByText(item)).toBeOnTheScreen();
    }
    expect(screen.getByText(SOURCES)).toBeOnTheScreen();
  });

  it('closes with the disclaimer', async () => {
    await renderMethod();

    expect(screen.getByTestId('disclaimer')).toHaveTextContent(DISCLAIMER);
    expect(DISCLAIMER).toMatch(/not investment advice/);
  });

  it('leads on to the holdings the verdicts are for', async () => {
    const { app } = await renderMethod();

    await fireEvent.press(screen.getByRole('link', { name: 'See the verdicts on your holdings' }));

    await waitFor(() => expect(app.getPathname()).toBe('/holdings'), LONG);
  });
});

describe('on a narrow screen', () => {
  it('reads each row as a card, without a column of headings', async () => {
    setWindowWidth(390);
    await renderMethod();

    expect(screen.queryByText('Tier')).toBeNull();
    expect(screen.getAllByText('Source')).toHaveLength(SIGNAL_RULES.length);
    for (const rule of TIER_RULES) {
      expect(
        within(screen.getByTestId(`tiers-${rule.tier}`)).getByText(tierLabel(rule.tier)),
      ).toBeOnTheScreen();
    }
  });
});
