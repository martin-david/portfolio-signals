import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, screen, waitFor, within } from 'expo-router/testing-library';

import { cannotSee } from '@/features/holdings/detail';
import { formatMoney } from '@/lib/format';
import { PREFERENCES_KEY } from '@/lib/preferences';
import { loadDemo, type Demo } from '@/test/demo';
import { renderRouted, type RoutedOptions } from '@/test/renderRouted';
import { setWindowWidth } from '@/test/window';
import { HIDDEN_AMOUNT } from '@/ui';

import { HoldingScreen } from './HoldingScreen';

// The first render of the router is slow.
jest.setTimeout(30_000);
const LONG = { timeout: 10_000 };

let demo: Demo;

beforeAll(async () => {
  demo = await loadDemo();
});

beforeEach(async () => {
  await AsyncStorage.clear();
  setWindowWidth(1280);
});

afterEach(() => {
  jest.restoreAllMocks();
});

async function renderHolding(symbol: string, options: RoutedOptions = {}) {
  const rendered = await renderRouted(() => <HoldingScreen symbol={symbol} />, options);
  await waitFor(() => expect(screen.queryByLabelText(`Loading ${symbol}`)).toBeNull(), LONG);
  return rendered;
}

const rowOf = (symbol: string) => demo.analysis.holdings.find((r) => r.holding.symbol === symbol)!;

describe('a holding with full coverage', () => {
  it('names the holding, gives its verdict and score, and says how fresh the signals are', async () => {
    await renderHolding('NWND');

    expect(await screen.findByRole('header', { name: 'NWND' })).toBeOnTheScreen();
    expect(screen.getByTestId('holding-verdict')).toHaveAccessibleName(
      'Verdict: Hold, review size',
    );
    expect(screen.getByText('Northwind Systems · Technology · Stock')).toBeOnTheScreen();
    expect(screen.getByTestId('holding-score')).toHaveTextContent('Score 75, Strong');
    expect(
      screen.getByText(/^TipRanks signals from \d+ \w{3} \d{4}, \d\d:\d\d UTC \(/),
    ).toBeOnTheScreen();
  });

  it('shows the position: what it is worth, what it cost and how it stands', async () => {
    await renderHolding('NWND');
    const { holding } = rowOf('NWND');

    const position = within(await screen.findByTestId('position'));

    expect(position.getByText(formatMoney(holding.value))).toBeOnTheScreen();
    expect(position.getByText(formatMoney(holding.invested))).toBeOnTheScreen();
    expect(position.getByText(/^\+42\.6% \(/)).toBeOnTheScreen();
    expect(position.getByText('32.0% of the account')).toBeOnTheScreen();
    expect(position.getByText('253.7165')).toBeOnTheScreen();
    expect(position.queryByText('Leverage')).toBeNull();
  });

  it('lists the flags, each with a glyph and a word for its severity', async () => {
    await renderHolding('NWND');

    const flags = within(await screen.findByTestId('flags'));

    expect(flags.getByText('Alert')).toBeOnTheScreen();
    expect(flags.getByText('32.0% of the account in one stock')).toBeOnTheScreen();
    expect(flags.getByText('Single-name risk outweighs any analyst signal.')).toBeOnTheScreen();
    expect(flags.getByText('Info')).toBeOnTheScreen();
    expect(flags.getByText(/^Earnings in \d+ days/)).toBeOnTheScreen();
  });

  it('lays out the six signals with their scales and readings', async () => {
    await renderHolding('NWND');

    const signals = within(await screen.findByTestId('signals'));

    for (const [heading, reading, spoken] of [
      ['Smart Score', '9/10', 'Smart Score 9 of 10'],
      ['Consensus', 'Strong Buy', 'Analyst consensus Strong Buy'],
      ['Target upside', '+11.3%', 'Target upside +11.3 percent'],
      ['AI models', '82/100', 'AI score 82 of 100'],
      ['Trend', 'Strong Buy', 'Technical trend Strong Buy'],
      ['Analyst breadth', '31 analysts', 'Analyst breadth over 31 analysts'],
    ]) {
      expect(signals.getByText(heading)).toBeOnTheScreen();
      expect(signals.getByRole('img', { name: spoken })).toBeOnTheScreen();
      expect(signals.getAllByText(reading).length).toBeGreaterThan(0);
    }
  });

  it('reports what the analysts, the AI models and the charts say, and when it reports next', async () => {
    await renderHolding('NWND');

    const analysts = within(await screen.findByTestId('analysts'));
    expect(
      analysts.getByText('24 Buy · 6 Hold · 1 Sell, 31 analysts in the last 12 months'),
    ).toBeOnTheScreen();
    expect(analysts.getByText('$160.00 to $250.00, median $210.00')).toBeOnTheScreen();

    const ai = within(screen.getByTestId('ai'));
    expect(ai.getByText('82/100, outperform')).toBeOnTheScreen();
    expect(ai.getByText('$214.00 (+13.6%)')).toBeOnTheScreen();

    const technicals = within(screen.getByTestId('technicals'));
    expect(technicals.getByText('Day')).toBeOnTheScreen();
    expect(technicals.getByText('Week')).toBeOnTheScreen();

    const momentum = within(screen.getByTestId('momentum'));
    expect(momentum.getByText('$190.47')).toBeOnTheScreen();
    expect(momentum.getByText('+28.4%')).toBeOnTheScreen();
    expect(momentum.getByText('+44.1%')).toBeOnTheScreen();
    expect(momentum.getByText('0.70%')).toBeOnTheScreen();

    expect(within(screen.getByTestId('earnings')).getByText(/in \d+ days$/)).toBeOnTheScreen();
  });

  it('closes with what the data cannot see, and what is not available yet', async () => {
    await renderHolding('NWND');

    const lines = within(await screen.findByTestId('cannot-see'));

    for (const line of cannotSee(rowOf('NWND'))) {
      expect(lines.getByText(line)).toBeOnTheScreen();
    }
    expect(screen.getByText(/Not available yet: the bull and bear case/)).toBeOnTheScreen();
    expect(screen.getByText(/Informational only, not investment advice/)).toBeOnTheScreen();
  });

  it('hides the amounts the user holds, and nothing else', async () => {
    await AsyncStorage.setItem(PREFERENCES_KEY, JSON.stringify({ hideAmounts: true }));
    await renderHolding('NWND');

    const position = within(await screen.findByTestId('position'));

    await waitFor(() =>
      expect(position.getAllByText(HIDDEN_AMOUNT).length).toBeGreaterThanOrEqual(3),
    );
    expect(position.queryByText(formatMoney(rowOf('NWND').holding.value))).toBeNull();
    expect(position.getByText('32.0% of the account')).toBeOnTheScreen();
    expect(screen.getByText('$190.47')).toBeOnTheScreen();
  });

  it('leads back to the holdings, and on to the rules behind the verdicts', async () => {
    const { app } = await renderHolding('NWND');

    await fireEvent.press(await screen.findByRole('link', { name: 'Back to all holdings' }));
    await waitFor(() => expect(app.getPathname()).toBe('/holdings'), LONG);
  });

  it('opens the Method page from its closing note', async () => {
    const { app } = await renderHolding('NWND');

    await fireEvent.press(await screen.findByRole('link', { name: 'How verdicts are decided' }));

    await waitFor(() => expect(app.getPathname()).toBe('/method'), LONG);
  });
});

describe('a holding with thin coverage', () => {
  it('says why a signal is missing instead of leaving a gap', async () => {
    await renderHolding('FRTH');

    const signals = within(await screen.findByTestId('signals'));

    expect(signals.getByText('Not available: no AI score')).toBeOnTheScreen();
    expect(signals.getByText('Not available: n/a')).toBeOnTheScreen();
    expect(signals.getByRole('img', { name: 'Smart Score 6 of 10' })).toBeOnTheScreen();
    expect(screen.getByTestId('holding-score')).toHaveTextContent('Score 31, Mixed');
    expect(screen.getByText('TipRanks has no AI analysis for this holding.')).toBeOnTheScreen();
    expect(screen.getByText('No technical analysis was reported.')).toBeOnTheScreen();
    expect(screen.getByText('Warning')).toBeOnTheScreen();
  });
});

describe('a holding without coverage', () => {
  it('has no signals to show and says why, without drawing sections that would be empty', async () => {
    await renderHolding('TREY');

    expect(await screen.findByRole('header', { name: 'TREY' })).toBeOnTheScreen();
    expect(screen.getByTestId('holding-score')).toHaveTextContent('No score (No data)');
    expect(screen.queryByTestId('signals')).toBeNull();
    expect(screen.getAllByText('Only single stocks are scored.').length).toBeGreaterThan(0);
    expect(screen.queryByTestId('analysts')).toBeNull();
    expect(screen.queryByTestId('ai')).toBeNull();
    expect(screen.getByTestId('cannot-see')).toBeOnTheScreen();
  });
});

describe('when the holding is not there', () => {
  it('says that a symbol outside the latest snapshot is not in it, and leads back', async () => {
    const { app } = await renderHolding('ZZZZ');

    expect(await screen.findByText('ZZZZ is not in your latest snapshot')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('link', { name: 'Back to all holdings' }));
    await waitFor(() => expect(app.getPathname()).toBe('/holdings'), LONG);
  });

  it('shows placeholders while it loads', async () => {
    await renderRouted(() => <HoldingScreen symbol="NWND" />, {
      intercept: (request, forward) =>
        request.url.endsWith('/portfolio/holdings/NWND')
          ? new Promise<Response>(() => undefined)
          : forward(request),
    });

    expect(await screen.findByLabelText('Loading NWND')).toBeOnTheScreen();
  });

  it('says so when loading fails, and tries again on request', async () => {
    let down = true;
    await renderHolding('NWND', {
      intercept: async (request, forward) =>
        down && request.url.endsWith('/portfolio/holdings/NWND')
          ? new Response(JSON.stringify({ status: 500, title: 'Boom' }), { status: 500 })
          : forward(request),
    });

    expect(await screen.findByText("Couldn't load NWND", {}, LONG)).toBeOnTheScreen();
    down = false;
    await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByRole('header', { name: 'NWND' }, LONG)).toBeOnTheScreen();
  });
});
