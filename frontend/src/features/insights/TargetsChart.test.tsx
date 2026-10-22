import { fireEvent, screen, within } from '@testing-library/react-native';

import { describeTargets, type TargetRow } from '@/features/portfolio/charts';
import { formatPercent } from '@/lib/format';
import { renderUi } from '@/test/renderUi';

import { TargetsChart, TargetsKey } from './TargetsChart';

const rows: TargetRow[] = [
  { symbol: 'NWND', weightPct: 32, street: 41.3, ai: 12.1, analysts: 31, verdict: 'Hold' },
  { symbol: 'CTSO', weightPct: 8.4, street: 22, ai: null, analysts: 1, verdict: 'Watch' },
];

// The plot is a picture that assistive technology skips, so queries have to look at hidden elements to find it.
const hidden = { includeHiddenElements: true };

async function layOut(width: number) {
  await fireEvent(screen.getByTestId('targets-measure'), 'layout', {
    nativeEvent: { layout: { x: 0, y: 0, width, height: 38 } },
  });
}

describe('TargetsChart', () => {
  it('says each holding\u2019s numbers in words, as one list item per holding', async () => {
    await renderUi(<TargetsChart rows={rows} />);

    expect(screen.getAllByRole('listitem')).toHaveLength(rows.length);
    for (const row of rows) {
      const item = within(screen.getByTestId(`target-${row.symbol}`));
      expect(item.getByText(row.symbol)).toBeOnTheScreen();
      expect(item.getByText(formatPercent(row.weightPct))).toBeOnTheScreen();
      expect(item.getByText(describeTargets(row))).toBeOnTheScreen();
    }
    expect(screen.getByText('Street +22.0% \u00b7 AI n/a \u00b7 1 analyst')).toBeOnTheScreen();
  });

  it('draws the plots once it knows its width: a dot for the Street, a diamond where the models have a target', async () => {
    await renderUi(<TargetsChart rows={rows} />);
    expect(screen.queryByTestId('plot-NWND', hidden)).toBeNull();

    await layOut(400);

    expect(screen.getByTestId('plot-NWND', hidden)).toBeOnTheScreen();
    expect(screen.getByTestId('street-NWND', hidden)).toBeOnTheScreen();
    expect(screen.getByTestId('ai-NWND', hidden)).toBeOnTheScreen();
    expect(screen.getByTestId('street-CTSO', hidden)).toBeOnTheScreen();
    expect(screen.queryByTestId('ai-CTSO', hidden)).toBeNull();
  });

  it('keeps the picture and its scale out of the accessibility tree', async () => {
    await renderUi(<TargetsChart rows={rows} />);
    await layOut(400);

    expect(screen.queryByTestId('plot-NWND')).toBeNull();
    expect(screen.queryByText('price today')).toBeNull();
    expect(screen.getByText('price today', hidden)).toBeOnTheScreen();
    expect(screen.getByText('+50%', hidden)).toBeOnTheScreen();
  });

  it('draws again at a new width', async () => {
    await renderUi(<TargetsChart rows={rows} />);
    await layOut(400);
    const before = screen.getByTestId('plot-NWND', hidden).props.width;

    await layOut(640);

    expect(before).toBe(400);
    expect(screen.getByTestId('plot-NWND', hidden).props.width).toBe(640);
  });
});

describe('TargetsKey', () => {
  it('names the two marks', async () => {
    await renderUi(<TargetsKey />);

    expect(screen.getByText('Average Street target')).toBeOnTheScreen();
    expect(screen.getByText('AI-model target')).toBeOnTheScreen();
  });
});
