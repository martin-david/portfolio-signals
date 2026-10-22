import { fireEvent, screen, waitFor } from 'expo-router/testing-library';

import { queryKeys } from '@/api/queryKeys';
import { loadDemo, type Demo } from '@/test/demo';
import { renderRouted, type RoutedOptions } from '@/test/renderRouted';

import { DataFreshness } from './DataFreshness';

// The first render of the router is slow.
jest.setTimeout(30_000);
const LONG = { timeout: 10_000 };

let demo: Demo;

beforeAll(async () => {
  demo = await loadDemo();
});

function Fresh() {
  return <DataFreshness analysis={demo.analysis} />;
}

async function renderFresh(options: RoutedOptions = {}) {
  const rendered = await renderRouted(Fresh, options);
  await waitFor(
    () =>
      expect(rendered.queryClient.getQueryState(queryKeys.integrations)?.status).toBe('success'),
    LONG,
  );
  return rendered;
}

describe('DataFreshness', () => {
  it('says where the numbers come from and how old they are', async () => {
    await renderFresh();

    expect(
      await screen.findByText(/^eToro snapshot of \d+ \w{3} \d{4}, \d\d:\d\d UTC \(/),
    ).toBeOnTheScreen();
    expect(
      screen.getByText(/^TipRanks signals from \d+ \w{3} \d{4}, \d\d:\d\d UTC \(/),
    ).toBeOnTheScreen();
  });

  it('adds nothing when both providers are in order', async () => {
    await renderFresh();

    expect(await screen.findByTestId('data-freshness')).toBeOnTheScreen();
    expect(screen.queryByTestId('freshness-notices')).toBeNull();
  });

  it('says so when eToro rejected the credentials, and leads to Connections to put it right', async () => {
    const { app } = await renderFresh({ scenario: 'credentials-rejected' });

    expect(await screen.findByText('eToro rejected your credentials', {}, LONG)).toBeOnTheScreen();
    expect(screen.getByText(/You are seeing data from 2 days ago\./)).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Reconnect eToro' }));

    await waitFor(() => expect(app.getPathname()).toBe('/connections'), LONG);
  });

  it('says so when TipRanks is rate limiting, which does not call for a button', async () => {
    await renderFresh({ scenario: 'rate-limited' });

    expect(
      await screen.findByText('TipRanks is rate limiting requests', {}, LONG),
    ).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: /^(Re)?[Cc]onnect/ })).toBeNull();
  });

  it('shows no notices while the connections cannot be read', async () => {
    await renderRouted(Fresh, {
      intercept: async (request, forward) =>
        request.url.endsWith('/api/v1/integrations')
          ? Response.json({ status: 500, title: 'Boom' }, { status: 500 })
          : forward(request),
    });

    expect(await screen.findByTestId('data-freshness')).toBeOnTheScreen();
    expect(screen.getByText(/^eToro snapshot of/)).toBeOnTheScreen();
    expect(screen.queryByTestId('freshness-notices')).toBeNull();
  });
});
