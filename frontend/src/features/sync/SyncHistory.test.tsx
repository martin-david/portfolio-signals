import { fireEvent, screen } from '@testing-library/react-native';

import type { PortfolioSnapshotSummaryDto, SyncRunDto } from '@/api/schema';
import { SnapshotList } from '@/features/integrations/SnapshotList';
import { PREFERENCES_KEY } from '@/lib/preferences';
import { renderUi } from '@/test/renderUi';

import { SyncHistory } from './SyncHistory';

import AsyncStorage from '@react-native-async-storage/async-storage';

const NOW = new Date('2026-10-21T12:00:00Z');

function run(index: number, overrides: Partial<SyncRunDto> = {}): SyncRunDto {
  return {
    id: `run-${index}`,
    provider: index % 2 === 0 ? 'Etoro' : 'TipRanks',
    trigger: 'Scheduled',
    status: 'Succeeded',
    requestedAt: new Date(NOW.getTime() - index * 3_600_000).toISOString(),
    startedAt: new Date(NOW.getTime() - index * 3_600_000 + 1000).toISOString(),
    completedAt: new Date(NOW.getTime() - index * 3_600_000 + 61_000).toISOString(),
    itemsProcessed: 10 + index,
    failure: null,
    skipReason: null,
    ...overrides,
  };
}

describe('SyncHistory', () => {
  it('lists each run with what it did, how it went and when', async () => {
    await renderUi(
      <SyncHistory
        now={NOW}
        runs={[
          run(1, { trigger: 'Manual' }),
          run(2, {
            status: 'Failed',
            failure: { kind: 'RateLimited', message: 'Rate limit reached.', at: NOW.toISOString() },
          }),
          run(3, { status: 'Skipped', skipReason: 'No portfolio snapshot yet.' }),
        ]}
      />,
    );

    expect(screen.getAllByTestId(/^sync-run-/)).toHaveLength(3);
    expect(screen.getByText('TipRanks manual sync')).toBeOnTheScreen();
    expect(screen.getByText('11 items processed in 1 minute.')).toBeOnTheScreen();
    expect(screen.getByText('Succeeded')).toBeOnTheScreen();
    expect(screen.getByText('1 hour ago · 21 Oct 2026, 11:00 UTC')).toBeOnTheScreen();
    expect(screen.getByText('Failed')).toBeOnTheScreen();
    expect(screen.getByText('Rate limited: Rate limit reached.')).toBeOnTheScreen();
    expect(screen.getByText('Skipped')).toBeOnTheScreen();
    expect(screen.getByText('No portfolio snapshot yet.')).toBeOnTheScreen();
  });

  it('shows the latest few and the rest on request', async () => {
    const runs = Array.from({ length: 9 }, (_, index) => run(index + 1));
    await renderUi(<SyncHistory now={NOW} runs={runs} preview={4} />);

    expect(screen.getAllByTestId(/^sync-run-/)).toHaveLength(4);

    await fireEvent.press(screen.getByRole('button', { name: 'Show 5 more runs' }));
    expect(screen.getAllByTestId(/^sync-run-/)).toHaveLength(9);

    await fireEvent.press(screen.getByRole('button', { name: 'Show fewer' }));
    expect(screen.getAllByTestId(/^sync-run-/)).toHaveLength(4);
  });

  it('offers no toggle when everything fits, and uses the singular for one more run', async () => {
    const view = await renderUi(<SyncHistory now={NOW} runs={[run(1), run(2)]} preview={6} />);
    expect(screen.queryByRole('button')).toBeNull();
    await view.unmount();

    await renderUi(<SyncHistory now={NOW} runs={[run(1), run(2), run(3)]} preview={2} />);
    expect(screen.getByRole('button', { name: 'Show 1 more run' })).toBeOnTheScreen();
  });
});

describe('SnapshotList', () => {
  const snapshots: PortfolioSnapshotSummaryDto[] = [
    { snapshotId: 's2', takenAt: '2026-10-21T10:00:00Z', totalValue: 151037, positions: 15 },
    { snapshotId: 's1', takenAt: '2026-10-14T10:00:00Z', totalValue: 149500, positions: 1 },
  ];

  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('lists the snapshots with their size and value, and marks the latest', async () => {
    await renderUi(<SnapshotList snapshots={snapshots} />);

    expect(screen.getAllByTestId(/^snapshot-/)).toHaveLength(2);
    expect(screen.getByText('21 Oct 2026, 10:00 UTC')).toBeOnTheScreen();
    expect(screen.getByText('15 positions, the latest')).toBeOnTheScreen();
    expect(screen.getByText('1 position')).toBeOnTheScreen();
    expect(screen.getByText('$151,037')).toBeOnTheScreen();
    expect(screen.getByText('$149,500')).toBeOnTheScreen();
  });

  it('hides the values when the person asked to hide amounts', async () => {
    await AsyncStorage.setItem(PREFERENCES_KEY, JSON.stringify({ hideAmounts: true }));

    await renderUi(<SnapshotList snapshots={snapshots} />);

    expect(await screen.findAllByText('\u2022\u2022\u2022\u2022')).toHaveLength(2);
    expect(screen.queryByText('$151,037')).toBeNull();
    expect(screen.getByText('15 positions, the latest')).toBeOnTheScreen();
  });
});
