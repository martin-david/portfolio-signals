import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, screen, waitFor, within } from 'expo-router/testing-library';

import type { PortfolioAnalysisDto } from '@/api/schema';
import {
  attentionItems,
  buildFindings,
  buildHeadline,
  type CopySegment,
} from '@/features/portfolio/narrative';
import { buildStripSegments } from '@/features/portfolio/strip';
import { formatMoney, formatPercent, formatSignedMoney } from '@/lib/format';
import { PREFERENCES_KEY } from '@/lib/preferences';
import { makeAnalysis } from '@/test/analysisBuilders';
import { callBackend } from '@/test/apiTestUtils';
import { loadDemo, type Demo } from '@/test/demo';
import { renderRouted, type RoutedOptions } from '@/test/renderRouted';
import { HIDDEN_AMOUNT } from '@/ui';

import { OverviewScreen } from './OverviewScreen';

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

async function renderOverview(options: RoutedOptions = {}) {
  const rendered = await renderRouted(OverviewScreen, options);
  await waitFor(() => expect(screen.queryByLabelText('Loading your overview')).toBeNull(), LONG);
  return rendered;
}

const asText = (body: readonly CopySegment[]) =>
  body.map((part) => (typeof part === 'string' ? part : formatMoney(part.amount))).join('');

describe('with a synced portfolio', () => {
  it('leads with the answer and what lies behind it', async () => {
    await renderOverview();
    const { headline, lede } = buildHeadline(demo.analysis);

    expect(await screen.findByRole('header', { name: headline }, LONG)).toBeOnTheScreen();
    expect(screen.getByText(lede)).toBeOnTheScreen();
  });

  it('says where the numbers come from, how old they are and what the account is worth', async () => {
    await renderOverview();
    const { kpis } = demo.analysis;

    expect(
      await screen.findByText(/^eToro snapshot of \d+ \w{3} \d{4}, \d\d:\d\d UTC \(/),
    ).toBeOnTheScreen();
    expect(
      screen.getByText(/^TipRanks signals from \d+ \w{3} \d{4}, \d\d:\d\d UTC \(/),
    ).toBeOnTheScreen();
    expect(screen.getByText(formatMoney(kpis.totalValue))).toBeOnTheScreen();
    expect(screen.getByText(formatSignedMoney(kpis.unrealizedPnl))).toBeOnTheScreen();
  });

  it('splits the account by verdict, with a legend of names, shares and amounts', async () => {
    await renderOverview();
    const segments = buildStripSegments(demo.analysis, demo.portfolio.account);

    expect(
      await screen.findByRole('image', { name: /^Account value split by verdict: / }),
    ).toBeOnTheScreen();
    for (const part of segments) {
      const row = within(screen.getByTestId(`legend-${part.key}`));
      expect(row.getByText(part.name)).toBeOnTheScreen();
      expect(row.getByText(formatPercent(part.pct))).toBeOnTheScreen();
      expect(row.getByText(formatMoney(part.value))).toBeOnTheScreen();
    }
  });

  it('writes the findings from the numbers', async () => {
    await renderOverview();

    for (const finding of buildFindings(demo.analysis)) {
      const block = within(await screen.findByTestId(`finding-${finding.key}`));
      expect(block.getByRole('header', { name: finding.title })).toBeOnTheScreen();
      expect(block.getByText(asText(finding.body))).toBeOnTheScreen();
    }
  });

  it('lists what needs a look, biggest first, and opens the holding from its row', async () => {
    const { app } = await renderOverview();
    const items = attentionItems(demo.analysis);

    expect(await screen.findByRole('header', { name: 'Needs a look' })).toBeOnTheScreen();
    const rows = screen.getAllByTestId(/^attention-[A-Z]/);
    expect(rows.map((row) => row.props.testID)).toEqual(
      items.map((item) => `attention-${item.symbol}`),
    );
    const first = items[0];
    const link = screen.getByRole('link', {
      name: new RegExp(`^${first.symbol}, ${first.name}\\.`),
    });
    expect(link).toBeOnTheScreen();

    await fireEvent.press(link);

    await waitFor(() => expect(app.getPathname()).toBe(`/holdings/${first.symbol}`), LONG);
    expect(screen.getByTestId('route-stub')).toHaveTextContent(`Route: /holdings/${first.symbol}`);
  });

  it('offers all the holdings and the rules behind the verdicts', async () => {
    const { app } = await renderOverview();

    await fireEvent.press(
      await screen.findByRole('link', {
        name: `See all ${demo.analysis.holdings.length} holdings`,
      }),
    );
    await waitFor(() => expect(app.getPathname()).toBe('/holdings'), LONG);
  });

  it('closes with the API disclaimer and a link to the Method page', async () => {
    const { app } = await renderOverview();

    expect(await screen.findByText(demo.analysis.disclaimer)).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('link', { name: 'How verdicts are decided' }));

    await waitFor(() => expect(app.getPathname()).toBe('/method'), LONG);
  });

  it('hides every amount of the user but none of the shares when asked', async () => {
    await AsyncStorage.setItem(PREFERENCES_KEY, JSON.stringify({ hideAmounts: true }));
    await renderOverview();

    const size = within(await screen.findByTestId('legend-size'));
    await waitFor(() => expect(size.getByText(HIDDEN_AMOUNT)).toBeOnTheScreen());
    expect(
      size.getByText(formatPercent(buildStripSegments(demo.analysis)[0].pct)),
    ).toBeOnTheScreen();
    expect(screen.queryByText(formatMoney(demo.analysis.kpis.totalValue))).toBeNull();
    expect(screen.queryByText(/\$\d/)).toBeNull();
  });
});

describe('with nothing that needs a look', () => {
  it('says so instead of showing an empty list', async () => {
    const calm: PortfolioAnalysisDto = {
      ...demo.analysis,
      holdings: demo.analysis.holdings.filter(
        (row) => row.assessment.verdict === 'Hold' || row.assessment.verdict === 'NoData',
      ),
    };
    await renderOverview({
      intercept: async (request, forward) =>
        request.url.endsWith('/api/v1/portfolio/analysis') ? Response.json(calm) : forward(request),
    });

    expect(await screen.findByText('Nothing needs a look')).toBeOnTheScreen();
    expect(screen.queryByTestId('attention-list')).toBeNull();
  });

  it('says there is nothing to assess when the snapshot holds no positions', async () => {
    await renderOverview({
      intercept: async (request, forward) =>
        request.url.endsWith('/api/v1/portfolio/analysis')
          ? Response.json(makeAnalysis([]))
          : forward(request),
    });

    expect(
      await screen.findByRole('header', { name: 'There are no open positions to assess.' }),
    ).toBeOnTheScreen();
    expect(screen.getByText('Nothing needs a look')).toBeOnTheScreen();
  });
});

describe('before the first sync', () => {
  it('says the portfolio is not here yet and what to do, in order', async () => {
    await renderOverview({ scenario: 'empty' });

    expect(
      await screen.findByRole('header', { name: 'Your portfolio is not here yet.' }),
    ).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Get started' })).toBeOnTheScreen();
    expect(within(screen.getByTestId('step-etoro')).getByText('To do')).toBeOnTheScreen();
    expect(within(screen.getByTestId('step-tipranks')).getByText('To do')).toBeOnTheScreen();
    expect(within(screen.getByTestId('step-sync')).getByText('Waiting')).toBeOnTheScreen();
    expect(screen.queryByTestId('verdict-strip')).toBeNull();
  });

  it('sends the person to Connections to connect a provider', async () => {
    const { app } = await renderOverview({ scenario: 'empty' });

    await fireEvent.press(await screen.findByRole('button', { name: 'Connect eToro' }));

    await waitFor(() => expect(app.getPathname()).toBe('/connections'), LONG);
  });

  it('follows the connections as they are made and starts the first sync from here', async () => {
    const { backend, queryClient } = await renderOverview({ scenario: 'empty' });
    await screen.findByTestId('step-etoro');

    await callBackend(backend, 'PUT', '/integrations/Etoro', {
      credentials: { apiKey: 'key', userKey: 'user' },
    });
    await act(async () => {
      await queryClient.invalidateQueries();
    });

    const etoro = within(await screen.findByTestId('step-etoro'));
    await waitFor(() => expect(etoro.getByText('Done')).toBeOnTheScreen(), LONG);
    expect(etoro.getByText('eToro is connected')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Connect TipRanks' })).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Sync now' }));

    expect(await screen.findByText('eToro sync queued.')).toBeOnTheScreen();
    const sync = within(screen.getByTestId('step-sync'));
    expect(await sync.findByText('The first sync is running')).toBeOnTheScreen();
    expect(sync.getByText('In progress')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Sync now' })).toBeNull();
  });

  it('says why a sync could not be started', async () => {
    const { backend, queryClient } = await renderOverview({
      scenario: 'empty',
      intercept: async (request, forward) =>
        request.method === 'POST' && request.url.endsWith('/api/v1/sync')
          ? Response.json(
              { status: 429, title: 'A manual sync was requested too recently' },
              { status: 429, headers: { 'Content-Type': 'application/problem+json' } },
            )
          : forward(request),
    });
    await callBackend(backend, 'PUT', '/integrations/Etoro', {
      credentials: { apiKey: 'key', userKey: 'user' },
    });
    await act(async () => {
      await queryClient.invalidateQueries();
    });

    await fireEvent.press(await screen.findByRole('button', { name: 'Sync now' }));

    expect(await screen.findByText("Couldn't start the eToro sync")).toBeOnTheScreen();
    expect(screen.getByText('A manual sync was requested too recently.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Sync now' })).toBeOnTheScreen();
  });

  it('does not offer a manual sync when the plan has none', async () => {
    const { backend, queryClient } = await renderOverview({
      scenario: 'empty',
      intercept: async (request, forward) => {
        const response = await forward(request);
        if (request.url.endsWith('/api/v1/me') && request.method === 'GET') {
          return Response.json({ ...(await response.json()), allowsManualSync: false });
        }
        return response;
      },
    });
    await callBackend(backend, 'PUT', '/integrations/Etoro', {
      credentials: { apiKey: 'key', userKey: 'user' },
    });
    await act(async () => {
      await queryClient.invalidateQueries();
    });

    expect(await screen.findByText('Wait for the first sync')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Sync now' })).toBeNull();
  });
});

describe('when a provider has a problem', () => {
  it('asks to reconnect when eToro rejected the credentials, and says what is being shown', async () => {
    const { app } = await renderOverview({ scenario: 'credentials-rejected' });

    expect(await screen.findByText('eToro rejected your credentials')).toBeOnTheScreen();
    expect(screen.getByText(/You are seeing data from /)).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Reconnect eToro' }));

    await waitFor(() => expect(app.getPathname()).toBe('/connections'), LONG);
  });

  it('reports rate limiting by TipRanks without an alarm', async () => {
    await renderOverview({ scenario: 'rate-limited' });

    expect(await screen.findByText('TipRanks is rate limiting requests')).toBeOnTheScreen();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('offers to connect TipRanks when it is not connected, while still showing the analysis', async () => {
    const { backend, queryClient, app } = await renderOverview();
    await screen.findByTestId('verdict-strip');

    await callBackend(backend, 'DELETE', '/integrations/TipRanks');
    await act(async () => {
      await queryClient.invalidateQueries();
    });

    expect(await screen.findByText('TipRanks is not connected')).toBeOnTheScreen();
    expect(screen.getByTestId('verdict-strip')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Connect TipRanks' }));
    await waitFor(() => expect(app.getPathname()).toBe('/connections'), LONG);
  });
});

describe('when the overview cannot be loaded', () => {
  it('shows placeholders while it loads', async () => {
    await renderRouted(OverviewScreen, {
      intercept: (request, forward) =>
        request.url.endsWith('/api/v1/portfolio/analysis')
          ? new Promise<Response>(() => undefined)
          : forward(request),
    });

    expect(await screen.findByLabelText('Loading your overview')).toBeOnTheScreen();
  });

  it('says so and tries again on request', async () => {
    let down = true;
    await renderOverview({
      intercept: async (request, forward) =>
        down && request.url.endsWith('/api/v1/portfolio/analysis')
          ? Response.json({ status: 500, title: 'Boom' }, { status: 500 })
          : forward(request),
    });

    expect(await screen.findByText("Couldn't load your overview", {}, LONG)).toBeOnTheScreen();
    expect(screen.getByText('The server had a problem. Try again in a moment.')).toBeOnTheScreen();

    down = false;
    await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));

    expect(
      await screen.findByRole('header', { name: buildHeadline(demo.analysis).headline }, LONG),
    ).toBeOnTheScreen();
  });
});
