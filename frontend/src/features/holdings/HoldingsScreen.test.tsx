import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, screen, waitFor, within } from 'expo-router/testing-library';
import { Platform } from 'react-native';

import type { PortfolioAnalysisDto } from '@/api/schema';
import { sortHoldings } from '@/features/portfolio/panel';
import { verdictMeta } from '@/features/portfolio/verdicts';
import { formatMoney } from '@/lib/format';
import { PREFERENCES_KEY } from '@/lib/preferences';
import { loadDemo, type Demo } from '@/test/demo';
import { renderRouted, type RoutedOptions } from '@/test/renderRouted';
import { setWindowWidth } from '@/test/window';
import { HIDDEN_AMOUNT } from '@/ui';

import { HoldingsScreen } from './HoldingsScreen';

// The first render of the router is slow.
jest.setTimeout(30_000);
const LONG = { timeout: 10_000 };

let demo: Demo;

beforeAll(async () => {
  demo = await loadDemo();
});

beforeEach(async () => {
  await AsyncStorage.clear();
});

afterEach(() => {
  jest.restoreAllMocks();
});

const WIDE = 1280;
const MEDIUM = 750;
const PHONE = 390;

async function renderHoldings(width: number, options: RoutedOptions = {}) {
  setWindowWidth(width);
  const rendered = await renderRouted(HoldingsScreen, options);
  await waitFor(() => expect(screen.queryByLabelText('Loading your holdings')).toBeNull(), LONG);
  return rendered;
}

const symbolsShown = () =>
  screen
    .getAllByTestId(/^holding-row-/)
    .map((row) => String(row.props.testID).slice('holding-row-'.length));

const bySymbol = (symbol: string) =>
  demo.analysis.holdings.find((row) => row.holding.symbol === symbol)!;

describe('the instrument panel (a wide window)', () => {
  it('shows one row per holding, the largest first, under the headings of a table', async () => {
    await renderHoldings(WIDE);

    const table = await screen.findByTestId('holdings-table');
    expect(table.props.role).toBe('table');
    expect(table).toHaveAccessibleName('Holdings, one row each');
    for (const heading of [
      'Holding, weight',
      'Verdict',
      'Score',
      'Smart Score',
      'Consensus',
      'Target upside',
      'AI models',
      'Trend',
      'Analyst breadth',
      'vs your cost',
    ]) {
      expect(within(table).getByText(heading)).toBeOnTheScreen();
    }
    expect(symbolsShown()).toEqual(
      sortHoldings(demo.analysis.holdings, { key: 'weight', direction: 'desc' }).map(
        (row) => row.holding.symbol,
      ),
    );
    expect(symbolsShown()).toHaveLength(demo.analysis.holdings.length);
  });

  it('gives each holding its verdict, score, six signals and result against cost', async () => {
    await renderHoldings(WIDE);
    const row = bySymbol('NWND');
    const nwnd = within(await screen.findByTestId('holding-row-NWND'));

    expect(
      nwnd.getByLabelText(`Verdict: ${verdictMeta[row.assessment.verdict].name}`),
    ).toBeOnTheScreen();
    expect(nwnd.getByText(String(row.assessment.composite))).toBeOnTheScreen();
    expect(nwnd.getByText('Strong')).toBeOnTheScreen();
    for (const spoken of [
      'Smart Score 9 of 10',
      'Analyst consensus Strong Buy',
      'Target upside +11.3 percent',
      'AI score 82 of 100',
      'Technical trend Strong Buy',
      'Analyst breadth over 31 analysts',
    ]) {
      expect(nwnd.getByRole('img', { name: spoken })).toBeOnTheScreen();
    }
    expect(nwnd.getByText('+42.6%')).toBeOnTheScreen();
    expect(nwnd.getByText(formatMoney(row.holding.pnl).replace('$', '+$'))).toBeOnTheScreen();
  });

  it('says why a holding has no signals instead of drawing empty bars', async () => {
    await renderHoldings(WIDE);

    const trey = within(await screen.findByTestId('holding-row-TREY'));

    expect(trey.getByText('Only single stocks are scored.')).toBeOnTheScreen();
    expect(trey.queryByRole('img')).toBeNull();
  });

  it('says what is missing for a holding with some signals', async () => {
    await renderHoldings(WIDE);

    const frth = within(await screen.findByTestId('holding-row-FRTH'));

    expect(frth.getByText('no AI score')).toBeOnTheScreen();
    expect(frth.getByText('n/a')).toBeOnTheScreen();
    expect(frth.getByRole('img', { name: 'Smart Score 6 of 10' })).toBeOnTheScreen();
  });

  it('sorts by a column and flips the direction on the second press', async () => {
    await renderHoldings(WIDE);
    await screen.findByTestId('holding-row-NWND');
    expect(screen.getByTestId('panel-caption')).toHaveTextContent(
      'Showing 15 of 15. Sorted by weight, largest first.',
    );

    await fireEvent.press(screen.getByTestId('sort-verdict'));

    expect(screen.getByTestId('panel-caption')).toHaveTextContent(
      /Sorted by verdict, holds first\./,
    );
    const verdicts = symbolsShown().map(
      (symbol) => verdictMeta[bySymbol(symbol).assessment.verdict].order,
    );
    expect(verdicts).toEqual([...verdicts].sort((a, b) => a - b));

    await fireEvent.press(screen.getByTestId('sort-verdict'));

    expect(screen.getByTestId('panel-caption')).toHaveTextContent(
      /Sorted by verdict, no data first\./,
    );
    expect(verdictMeta[bySymbol(symbolsShown()[0]).assessment.verdict].label).toBe('NO DATA');

    await fireEvent.press(screen.getByTestId('sort-pnl'));
    const results = symbolsShown().map((symbol) => bySymbol(symbol).holding.pnlPct);
    expect(results).toEqual([...results].sort((a, b) => b - a));
  });

  it('filters to the positions above 1%, or to the ones to watch or review', async () => {
    await renderHoldings(WIDE);
    await screen.findByTestId('holding-row-NWND');
    expect(screen.getByTestId('filter-all')).toBeSelected();

    await fireEvent.press(screen.getByTestId('filter-material'));

    const material = demo.analysis.holdings.filter((row) => row.assessment.material);
    expect(symbolsShown()).toHaveLength(material.length);
    expect(screen.getByTestId('filter-material')).toBeSelected();
    expect(screen.getByTestId('filter-all')).not.toBeSelected();
    expect(screen.getByTestId('panel-caption')).toHaveTextContent(
      new RegExp(`Showing ${material.length} of ${demo.analysis.holdings.length}\\.`),
    );

    await fireEvent.press(screen.getByTestId('filter-attention'));

    expect(symbolsShown().sort()).toEqual(['ADWK', 'FBRK', 'FRTH', 'LTWR', 'TLSP']);
  });

  it('counts what each filter holds in its label', async () => {
    await renderHoldings(WIDE);

    expect(await screen.findByRole('button', { name: 'All 15' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Above 1% (11)' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Watch or review (5)' })).toBeOnTheScreen();
  });
});

describe('opening a holding', () => {
  it('fetches the analysts only when the row is opened, and shows them with the flags', async () => {
    const requested: string[] = [];
    const { app } = await renderHoldings(WIDE, {
      intercept: async (request, forward) => {
        requested.push(new URL(request.url).pathname);
        return forward(request);
      },
    });
    await screen.findByTestId('holding-row-NWND');
    const lookups = () =>
      requested.filter((path) => path.startsWith('/api/v1/portfolio/holdings/'));
    expect(lookups()).toEqual([]);
    expect(screen.getByTestId('toggle-NWND')).not.toBeExpanded();
    expect(screen.queryByTestId('holding-detail-NWND')).toBeNull();

    await fireEvent.press(screen.getByTestId('toggle-NWND'));

    expect(screen.getByTestId('toggle-NWND')).toBeExpanded();
    const detail = within(await screen.findByTestId('holding-detail-NWND'));
    expect(
      await detail.findByText('24 Buy · 6 Hold · 1 Sell, 31 analysts in the last 12 months'),
    ).toBeOnTheScreen();
    expect(detail.getByText('$212.00 (+11.3% from the $190.47 price)')).toBeOnTheScreen();
    expect(detail.getByText('Alert')).toBeOnTheScreen();
    expect(detail.getByText('32.0% of the account in one stock')).toBeOnTheScreen();
    expect(detail.getByText('Info')).toBeOnTheScreen();
    expect(lookups()).toEqual(['/api/v1/portfolio/holdings/NWND']);

    await fireEvent.press(
      detail.getByRole('link', { name: 'Everything about NWND, Northwind Systems' }),
    );
    await waitFor(() => expect(app.getPathname()).toBe('/holdings/NWND'), LONG);
  });

  it('closes it again, and keeps several open at once', async () => {
    await renderHoldings(WIDE);
    await screen.findByTestId('holding-row-NWND');

    await fireEvent.press(screen.getByTestId('toggle-NWND'));
    await fireEvent.press(screen.getByTestId('toggle-CTSO'));
    expect(await screen.findByTestId('holding-detail-NWND')).toBeOnTheScreen();
    expect(await screen.findByTestId('holding-detail-CTSO')).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId('toggle-NWND'));

    expect(screen.queryByTestId('holding-detail-NWND')).toBeNull();
    expect(screen.getByTestId('toggle-NWND')).not.toBeExpanded();
    expect(screen.getByTestId('holding-detail-CTSO')).toBeOnTheScreen();
  });

  it('does not ask for analysts of a holding that has no coverage', async () => {
    const requested: string[] = [];
    await renderHoldings(WIDE, {
      intercept: async (request, forward) => {
        requested.push(new URL(request.url).pathname);
        return forward(request);
      },
    });

    await fireEvent.press(await screen.findByTestId('toggle-TREY'));

    const detail = within(await screen.findByTestId('holding-detail-TREY'));
    expect(detail.getByText('No analyst signals for this holding.')).toBeOnTheScreen();
    expect(detail.getByText('Not covered by this analysis')).toBeOnTheScreen();
    expect(requested.some((path) => path.endsWith('/holdings/TREY'))).toBe(false);
  });

  it('says so when the analysts cannot be loaded, and tries again on request', async () => {
    let down = true;
    await renderHoldings(WIDE, {
      intercept: async (request, forward) =>
        down && request.url.endsWith('/portfolio/holdings/NWND')
          ? new Response(JSON.stringify({ status: 500, title: 'Boom' }), { status: 500 })
          : forward(request),
    });

    await fireEvent.press(await screen.findByTestId('toggle-NWND'));

    const detail = within(await screen.findByTestId('holding-detail-NWND'));
    expect(await detail.findByText("Couldn't load the analysts", {}, LONG)).toBeOnTheScreen();
    down = false;
    await fireEvent.press(detail.getByRole('button', { name: 'Try again' }));
    expect(
      await detail.findByText(
        '24 Buy · 6 Hold · 1 Sell, 31 analysts in the last 12 months',
        {},
        LONG,
      ),
    ).toBeOnTheScreen();
  });
});

describe('on the web', () => {
  beforeEach(() => {
    jest.replaceProperty(Platform, 'OS', 'web');
  });

  it('exposes the sort state in aria-sort, the toggle state in aria-expanded and what it controls', async () => {
    await renderHoldings(WIDE);
    await screen.findByTestId('holding-row-NWND');

    expect(screen.getByTestId('column-weight').props['aria-sort']).toBe('descending');
    expect(screen.getByTestId('column-verdict').props['aria-sort']).toBe('none');

    await fireEvent.press(screen.getByTestId('sort-weight'));
    expect(screen.getByTestId('column-weight').props['aria-sort']).toBe('ascending');

    const toggle = screen.getByTestId('toggle-NWND');
    expect(toggle).not.toBeExpanded();
    expect(toggle.props['aria-controls']).toBe('holding-detail-NWND');
    await fireEvent.press(toggle);
    expect(screen.getByTestId('toggle-NWND')).toBeExpanded();
    expect((await screen.findByTestId('holding-detail-NWND')).props.nativeID).toBe(
      'holding-detail-NWND',
    );
  });

  it('says which filter is in use with aria-pressed', async () => {
    await renderHoldings(WIDE);
    await screen.findByTestId('holding-row-NWND');

    expect(screen.getByTestId('filter-all').props['aria-pressed']).toBe(true);
    expect(screen.getByTestId('filter-material').props['aria-pressed']).toBe(false);

    await fireEvent.press(screen.getByTestId('filter-material'));

    expect(screen.getByTestId('filter-all').props['aria-pressed']).toBe(false);
    expect(screen.getByTestId('filter-material').props['aria-pressed']).toBe(true);
  });
});

describe('one line per holding (a window without room for the bars)', () => {
  it('replaces the column headings with a way to sort, and keeps the result in a column', async () => {
    await renderHoldings(MEDIUM);

    expect(await screen.findByTestId('sort-bar')).toBeOnTheScreen();
    expect(screen.queryByTestId('holdings-table')).toBeNull();
    expect(screen.queryByTestId('column-weight')).toBeNull();
    expect(screen.getByTestId('sort-weight')).toBeSelected();
    const nwnd = within(screen.getByTestId('holding-row-NWND'));
    expect(nwnd.getByText('+42.6%')).toBeOnTheScreen();
    expect(nwnd.queryByRole('img')).toBeNull();

    await fireEvent.press(screen.getByTestId('sort-score'));

    expect(screen.getByTestId('sort-score')).toBeSelected();
    expect(screen.getByTestId('sort-weight')).not.toBeSelected();
    const scores = symbolsShown().map((symbol) => bySymbol(symbol).assessment.composite);
    const known = scores.filter((score): score is number => score !== null);
    expect(known).toEqual([...known].sort((a, b) => b - a));
  });

  it('puts the signals in words inside the details', async () => {
    await renderHoldings(MEDIUM);

    await fireEvent.press(await screen.findByTestId('toggle-NWND'));

    const detail = within(await screen.findByTestId('holding-detail-NWND'));
    expect(detail.getByText('Smart Score 9/10')).toBeOnTheScreen();
    expect(detail.getByText('Consensus Strong Buy')).toBeOnTheScreen();
    expect(detail.getByText('Target upside +11.3%')).toBeOnTheScreen();
    expect(detail.getByText('AI models 82/100')).toBeOnTheScreen();
    expect(detail.getByText('Trend Strong Buy')).toBeOnTheScreen();
    expect(detail.getByText('Analyst breadth 31 analysts')).toBeOnTheScreen();
    expect(detail.getByText('Signals')).toBeOnTheScreen();
  });

  it('moves the result against cost into the details on a phone', async () => {
    await renderHoldings(PHONE);
    const nwnd = within(await screen.findByTestId('holding-row-NWND'));
    expect(nwnd.queryByText('+42.6%')).toBeNull();

    await fireEvent.press(screen.getByTestId('toggle-NWND'));

    const detail = within(await screen.findByTestId('holding-detail-NWND'));
    expect(detail.getByText('Signals and result')).toBeOnTheScreen();
    expect(detail.getByText(/^\+42\.6% against your cost \(/)).toBeOnTheScreen();
  });

  it('labels a row with what it shows, since its parts are not read one by one', async () => {
    await renderHoldings(MEDIUM);
    const row = bySymbol('NWND');

    const toggle = await screen.findByTestId('toggle-NWND');

    expect(toggle).toHaveAccessibleName(
      `NWND, Northwind Systems. Hold, review size, ${row.assessment.weightPct.toFixed(1)}% of the account. Score 75, Strong.`,
    );
  });
});

describe('hiding amounts', () => {
  it('hides what the user holds in the rows and in the details, but not the shares', async () => {
    await AsyncStorage.setItem(PREFERENCES_KEY, JSON.stringify({ hideAmounts: true }));
    await renderHoldings(WIDE);

    const nwnd = within(await screen.findByTestId('holding-row-NWND'));
    await waitFor(() => expect(nwnd.getAllByText(HIDDEN_AMOUNT).length).toBeGreaterThan(0));
    expect(nwnd.getByText('+42.6%')).toBeOnTheScreen();
    expect(screen.queryByText(/\$\d/)).toBeNull();
  });
});

describe('without a panel to show', () => {
  it('sends the person to Connections before the first sync', async () => {
    const { app } = await renderHoldings(WIDE, { scenario: 'empty' });

    expect(await screen.findByText('No holdings yet')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Go to Connections' }));

    await waitFor(() => expect(app.getPathname()).toBe('/connections'), LONG);
  });

  it('says so when the snapshot holds no positions', async () => {
    await renderHoldings(WIDE, {
      intercept: async (request, forward) =>
        request.url.endsWith('/portfolio/analysis')
          ? new Response(JSON.stringify({ ...demo.analysis, holdings: [] }), {
              headers: { 'Content-Type': 'application/json' },
            })
          : forward(request),
    });

    expect(await screen.findByText('No holdings in the latest snapshot')).toBeOnTheScreen();
  });

  it('offers to show everything when a filter matches nothing', async () => {
    const calm: PortfolioAnalysisDto = {
      ...demo.analysis,
      holdings: demo.analysis.holdings.filter((row) => row.assessment.verdict === 'Hold'),
    };
    await renderHoldings(WIDE, {
      intercept: async (request, forward) =>
        request.url.endsWith('/portfolio/analysis')
          ? new Response(JSON.stringify(calm), { headers: { 'Content-Type': 'application/json' } })
          : forward(request),
    });
    await screen.findByTestId('holding-row-CTSO');

    await fireEvent.press(screen.getByTestId('filter-attention'));

    expect(await screen.findByText('No holdings match this filter')).toBeOnTheScreen();
    expect(screen.queryByTestId('holdings-panel')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Show all holdings' }));
    expect(await screen.findByTestId('holding-row-CTSO')).toBeOnTheScreen();
  });

  it('shows placeholders while loading, and says so when loading fails', async () => {
    setWindowWidth(WIDE);
    await renderRouted(HoldingsScreen, {
      intercept: (request, forward) =>
        request.url.endsWith('/portfolio/analysis')
          ? new Promise<Response>(() => undefined)
          : forward(request),
    });

    expect(await screen.findByLabelText('Loading your holdings')).toBeOnTheScreen();
  });

  it('tries again on request when the holdings cannot be loaded', async () => {
    let down = true;
    await renderHoldings(WIDE, {
      intercept: async (request, forward) =>
        down && request.url.endsWith('/portfolio/analysis')
          ? new Response(JSON.stringify({ status: 500, title: 'Boom' }), { status: 500 })
          : forward(request),
    });

    expect(await screen.findByText("Couldn't load your holdings", {}, LONG)).toBeOnTheScreen();
    down = false;
    await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByTestId('holding-row-NWND', {}, LONG)).toBeOnTheScreen();
  });
});

describe('when a provider has a problem', () => {
  it('says how old the data is and what is wrong, above the panel it is true of', async () => {
    await renderHoldings(WIDE, { scenario: 'credentials-rejected' });

    expect(await screen.findByText('eToro rejected your credentials', {}, LONG)).toBeOnTheScreen();
    expect(screen.getByText(/^eToro snapshot of .*\(2 days ago\)$/)).toBeOnTheScreen();
    expect(screen.getByTestId('holdings-table')).toBeOnTheScreen();
  });
});
