import { fireEvent, screen, waitFor, within } from 'expo-router/testing-library';

import type { PortfolioAnalysisDto } from '@/api/schema';
import {
  EARNINGS_WINDOW_DAYS,
  describeGaps,
  describeTargets,
  earningsByDay,
  earningsHeading,
  earningsSummary,
  targetGaps,
  targetRows,
} from '@/features/portfolio/charts';
import { formatDayLabel } from '@/lib/format';
import { loadDemo, type Demo } from '@/test/demo';
import { renderRouted, type RoutedOptions } from '@/test/renderRouted';

import { InsightsScreen } from './InsightsScreen';

// The first render of the router is slow.
jest.setTimeout(30_000);
const LONG = { timeout: 10_000 };

// The charts' pictures are hidden from assistive technology, so queries have to look at hidden elements to find them.
const hidden = { includeHiddenElements: true };

let demo: Demo;

beforeAll(async () => {
  demo = await loadDemo();
});

async function renderInsights(options: RoutedOptions = {}) {
  const rendered = await renderRouted(InsightsScreen, options);
  await waitFor(() => expect(screen.queryByLabelText('Loading your insights')).toBeNull(), LONG);
  return rendered;
}

function serving(analysis: PortfolioAnalysisDto): RoutedOptions {
  return {
    intercept: async (request, forward) =>
      request.url.endsWith('/api/v1/portfolio/analysis')
        ? Response.json(analysis)
        : forward(request),
  };
}

/** The analysis with nothing reporting earnings. */
function withoutEarnings(analysis: PortfolioAnalysisDto): PortfolioAnalysisDto {
  return {
    ...analysis,
    holdings: analysis.holdings.map((row) => ({
      ...row,
      assessment: {
        ...row.assessment,
        facts: { ...row.assessment.facts, nextEarningsDate: null, daysToEarnings: null },
      },
    })),
  };
}

/** The analysis with no target upside any holding could be scored on. */
function withoutTargets(analysis: PortfolioAnalysisDto): PortfolioAnalysisDto {
  return {
    ...analysis,
    holdings: analysis.holdings.map((row) => ({
      ...row,
      assessment: {
        ...row.assessment,
        components: { ...row.assessment.components, upside: null },
      },
    })),
  };
}

describe('with a synced portfolio', () => {
  it('asks the two questions the verdicts cannot answer alone', async () => {
    await renderInsights();
    const days = earningsByDay(demo.analysis);

    expect(await screen.findByRole('header', { name: 'Insights' })).toBeOnTheScreen();
    expect(
      screen.getByRole('header', { name: 'Where Wall Street and the AI models disagree' }),
    ).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: earningsHeading(days) })).toBeOnTheScreen();
  });

  it('lists the holdings that have analyst targets, biggest first, with every number in words', async () => {
    await renderInsights();
    const rows = targetRows(demo.analysis);

    expect(rows.length).toBeGreaterThan(3);
    await screen.findByTestId('targets-chart');
    const listed = screen.getAllByTestId(/^target-/).map((row) => row.props.testID);
    expect(listed).toEqual(rows.map((row) => `target-${row.symbol}`));
    for (const row of rows) {
      const item = within(screen.getByTestId(`target-${row.symbol}`));
      expect(item.getByText(row.symbol)).toBeOnTheScreen();
      expect(item.getByText(describeTargets(row))).toBeOnTheScreen();
    }
  });

  it('says what the two marks mean and where the Street and the models split', async () => {
    await renderInsights();
    const gaps = targetGaps(targetRows(demo.analysis));

    expect(await screen.findByTestId('targets-key')).toBeOnTheScreen();
    expect(screen.getByText('Average Street target')).toBeOnTheScreen();
    expect(screen.getByText('AI-model target')).toBeOnTheScreen();
    expect(screen.getByTestId('targets-caption')).toHaveTextContent(describeGaps(gaps));
  });

  it('shows who reports when, and how much of the account is behind it', async () => {
    await renderInsights();
    const days = earningsByDay(demo.analysis);

    expect(days.length).toBeGreaterThan(0);
    expect(await screen.findByTestId('earnings-summary')).toHaveTextContent(earningsSummary(days));
    for (const day of days) {
      const row = within(screen.getByTestId(`earnings-${day.date}`));
      expect(row.getByText(formatDayLabel(day.date))).toBeOnTheScreen();
      for (const item of day.items) {
        expect(row.getByText(new RegExp(`\\b${item.symbol}\\b`))).toBeOnTheScreen();
      }
    }
  });

  it('draws the plots when the charts have a width', async () => {
    await renderInsights();
    const [first] = targetRows(demo.analysis);
    const [firstDay] = earningsByDay(demo.analysis);
    await screen.findByTestId('targets-chart');
    expect(screen.queryByTestId(`plot-${first.symbol}`, hidden)).toBeNull();

    await fireEvent(screen.getByTestId('targets-measure'), 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 480, height: 38 } },
    });
    await fireEvent(screen.getByTestId('earnings-measure'), 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 480, height: 40 } },
    });

    expect(screen.getByTestId(`plot-${first.symbol}`, hidden)).toBeOnTheScreen();
    expect(screen.getByTestId(`bar-${firstDay.date}`, hidden)).toBeOnTheScreen();
  });

  it('says so when nothing reports within the window, and still shows the targets', async () => {
    await renderInsights(serving(withoutEarnings(demo.analysis)));

    expect(await screen.findByText('No earnings reports soon')).toBeOnTheScreen();
    expect(
      screen.getByText(`None of your stocks reports earnings within ${EARNINGS_WINDOW_DAYS} days.`),
    ).toBeOnTheScreen();
    expect(screen.queryByTestId('earnings-chart')).toBeNull();
    expect(screen.getByTestId('targets-chart')).toBeOnTheScreen();
  });

  it('says so when no holding has targets to compare, and still shows the earnings', async () => {
    await renderInsights(serving(withoutTargets(demo.analysis)));

    expect(await screen.findByText('Nothing to compare')).toBeOnTheScreen();
    expect(screen.queryByTestId('targets-chart')).toBeNull();
    expect(screen.getByTestId('earnings-chart')).toBeOnTheScreen();
  });
});

describe('before the first sync', () => {
  it('says there is nothing to draw yet and sends the person to Connections', async () => {
    const { app } = await renderInsights({ scenario: 'empty' });

    expect(await screen.findByText('No insights yet')).toBeOnTheScreen();
    expect(screen.queryByTestId('targets-chart')).toBeNull();
    expect(screen.queryByTestId('earnings-chart')).toBeNull();
    expect(screen.queryByTestId('data-freshness')).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'Go to Connections' }));

    await waitFor(() => expect(app.getPathname()).toBe('/connections'), LONG);
  });
});

describe('when a provider has a problem', () => {
  it('says how old the charts are and what is wrong, since they are only as new as the last good sync', async () => {
    await renderInsights({ scenario: 'credentials-rejected' });

    expect(await screen.findByText('eToro rejected your credentials', {}, LONG)).toBeOnTheScreen();
    expect(screen.getByText(/^eToro snapshot of .*\(2 days ago\)$/)).toBeOnTheScreen();
    expect(screen.getByTestId('targets-chart')).toBeOnTheScreen();
  });
});

describe('when the analysis cannot be had', () => {
  it('shows that it is loading', async () => {
    await renderRouted(InsightsScreen, {
      intercept: (request, forward) =>
        request.url.endsWith('/api/v1/portfolio/analysis')
          ? new Promise<Response>(() => undefined)
          : forward(request),
    });

    expect(await screen.findByLabelText('Loading your insights')).toBeOnTheScreen();
  });

  it('says so and tries again on request', async () => {
    let down = true;
    await renderInsights({
      intercept: async (request, forward) =>
        down && request.url.endsWith('/api/v1/portfolio/analysis')
          ? Response.json({ status: 500, title: 'Boom' }, { status: 500 })
          : forward(request),
    });

    expect(await screen.findByText("Couldn't load your insights", {}, LONG)).toBeOnTheScreen();
    expect(screen.getByText('The server had a problem. Try again in a moment.')).toBeOnTheScreen();

    down = false;
    await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByTestId('targets-chart', {}, LONG)).toBeOnTheScreen();
  });
});
