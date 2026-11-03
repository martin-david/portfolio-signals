import { fireEvent, screen, within } from '@testing-library/react-native';

import type { EarningsDay } from '@/features/portfolio/charts';
import { formatDayLabel, formatPercent } from '@/lib/format';
import { renderUi } from '@/test/renderUi';

import { EarningsChart } from './EarningsChart';

const days: EarningsDay[] = [
  {
    date: '2026-11-04',
    totalPct: 64,
    items: [
      { symbol: 'NWND', weightPct: 32 },
      { symbol: 'CTSO', weightPct: 32 },
    ],
  },
  { date: '2026-11-12', totalPct: 2.5, items: [{ symbol: 'TINY', weightPct: 2.5 }] },
];

// The bars are a picture that assistive technology skips, so queries have to look at hidden elements to find them.
const hidden = { includeHiddenElements: true };

async function layOut(width: number) {
  await fireEvent(screen.getByTestId('earnings-measure'), 'layout', {
    nativeEvent: { layout: { x: 0, y: 0, width, height: 40 } },
  });
}

describe('EarningsChart', () => {
  it('names each day, how much of the account reports on it and which holdings', async () => {
    await renderUi(<EarningsChart days={days} />);

    expect(screen.getAllByRole('listitem')).toHaveLength(days.length);
    for (const day of days) {
      const row = within(screen.getByTestId(`earnings-${day.date}`));
      expect(row.getByText(formatDayLabel(day.date))).toBeOnTheScreen();
      expect(
        row.getByText(
          `${formatPercent(day.totalPct)} \u00b7 ${day.items.map((item) => item.symbol).join(', ')}`,
        ),
      ).toBeOnTheScreen();
    }
  });

  it('draws a bar per day with a segment per holding, labelling only the segments that are wide enough', async () => {
    await renderUi(<EarningsChart days={days} />);
    expect(screen.queryByTestId('bar-2026-11-04', hidden)).toBeNull();

    await layOut(400);

    expect(screen.getByTestId('bar-2026-11-04', hidden)).toBeOnTheScreen();
    expect(screen.getByTestId('segment-2026-11-04-NWND', hidden)).toBeOnTheScreen();
    expect(screen.getByTestId('segment-2026-11-04-CTSO', hidden)).toBeOnTheScreen();
    expect(screen.getByTestId('label-2026-11-04-NWND', hidden)).toBeOnTheScreen();
    expect(screen.getByTestId('segment-2026-11-12-TINY', hidden)).toBeOnTheScreen();
    expect(screen.queryByTestId('label-2026-11-12-TINY', hidden)).toBeNull();
  });

  it('scales the axis to the busiest day, in steps of 25% of the account', async () => {
    await renderUi(<EarningsChart days={days} />);
    await layOut(400);

    for (const label of ['0%', '25%', '50%', '75% of account']) {
      expect(screen.getByText(label, hidden)).toBeOnTheScreen();
    }
    expect(screen.queryByText('0%')).toBeNull();
  });

  it('keeps at least 50% of the account on the axis when little reports', async () => {
    await renderUi(<EarningsChart days={[days[1]]} />);
    await layOut(400);

    expect(screen.getByText('50% of account', hidden)).toBeOnTheScreen();
    expect(screen.queryByText('75% of account', hidden)).toBeNull();
  });
});
