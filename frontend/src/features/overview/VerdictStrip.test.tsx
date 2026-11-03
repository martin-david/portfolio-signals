import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, screen, waitFor, within } from '@testing-library/react-native';
import { AccessibilityInfo, Animated } from 'react-native';

import { buildStripSegments, type StripSegment } from '@/features/portfolio/strip';
import { formatMoney, formatPercent } from '@/lib/format';
import { PREFERENCES_KEY } from '@/lib/preferences';
import { loadDemo } from '@/test/demo';
import { renderUi } from '@/test/renderUi';
import { HIDDEN_AMOUNT } from '@/ui';

import { VerdictStrip, stripLabel } from './VerdictStrip';

function segment(key: StripSegment['key'], pct: number): StripSegment {
  return { key, name: key, detail: '', value: pct * 1_000, pct };
}

describe('stripLabel', () => {
  it('names the segment and its share when there is room for both', () => {
    expect(stripLabel(segment('hold', 31), 1_200)).toBe('Hold 31%');
    expect(stripLabel(segment('size', 32), 1_200)).toBe('Hold, review size 32%');
  });

  it('keeps only the share when the name would be cut off', () => {
    // 32% of a phone's 358 dp is 115 dp, which fits "32%" but not "Hold, review size 32%".
    expect(stripLabel(segment('size', 32), 358)).toBe('32%');
    expect(stripLabel(segment('review', 6.2), 1_200)).toBe('6%');
  });

  it('leaves a narrow segment unlabelled, because the legend names it', () => {
    expect(stripLabel(segment('nodata', 0.8), 1_200)).toBeNull();
    expect(stripLabel(segment('review', 6.2), 358)).toBeNull();
  });

  it('rounds the share', () => {
    expect(stripLabel(segment('watch', 20.4), 1_200)).toBe('Watch 20%');
    expect(stripLabel(segment('watch', 19.6), 1_200)).toBe('Watch 20%');
  });
});

async function demoSegments() {
  const { analysis, portfolio } = await loadDemo();
  return { segments: buildStripSegments(analysis, portfolio.account), account: portfolio.account };
}

beforeEach(async () => {
  await AsyncStorage.clear();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('VerdictStrip', () => {
  it('is one picture with a spoken summary of every part of the account', async () => {
    const { segments } = await demoSegments();

    await renderUi(<VerdictStrip segments={segments} />);

    const bar = screen.getByRole('image', { name: /^Account value split by verdict: / });
    expect(bar).toHaveAccessibleName(/Hold, review size 32 percent/);
    expect(bar).toHaveAccessibleName(/Copy trading, not assessed 6 percent, Cash 4 percent$/);
  });

  it('draws a segment for each part, widest first as the account is split', async () => {
    const { segments } = await demoSegments();

    await renderUi(<VerdictStrip segments={segments} />);

    for (const { key } of segments) {
      expect(screen.getByTestId(`strip-segment-${key}`)).toBeOnTheScreen();
    }
  });

  it('names each part in the legend with what is in it, its share and its amount', async () => {
    const { segments } = await demoSegments();

    await renderUi(<VerdictStrip segments={segments} />);

    for (const part of segments) {
      const row = within(screen.getByTestId(`legend-${part.key}`));
      expect(row.getByText(part.name)).toBeOnTheScreen();
      expect(row.getByText(part.detail)).toBeOnTheScreen();
      expect(row.getByText(formatPercent(part.pct))).toBeOnTheScreen();
      expect(row.getByText(formatMoney(part.value))).toBeOnTheScreen();
    }
  });

  it('shows the amounts in the currency of the account', async () => {
    const { segments } = await demoSegments();

    await renderUi(<VerdictStrip segments={segments} currency="EUR" />);

    const size = within(screen.getByTestId('legend-size'));
    expect(size.getByText(formatMoney(segments[0].value, 'EUR'))).toBeOnTheScreen();
  });

  it('hides the amounts when the user asks, and keeps the shares', async () => {
    const { segments } = await demoSegments();
    await AsyncStorage.setItem(PREFERENCES_KEY, JSON.stringify({ hideAmounts: true }));

    await renderUi(<VerdictStrip segments={segments} />);

    const size = within(await screen.findByTestId('legend-size'));
    await waitFor(() => expect(size.getByText(HIDDEN_AMOUNT)).toBeOnTheScreen());
    expect(size.getByText(formatPercent(segments[0].pct))).toBeOnTheScreen();
    expect(screen.queryByText(formatMoney(segments[0].value))).toBeNull();
  });

  it('grows in from the left, over about a second', async () => {
    const timing = jest.spyOn(Animated, 'timing');
    const { segments } = await demoSegments();

    await renderUi(<VerdictStrip segments={segments} />);

    expect(screen.getByTestId('strip-bar')).toHaveStyle({ transform: [{ scaleX: 0 }] });
    await waitFor(() =>
      expect(timing).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ toValue: 1, duration: 900 }),
      ),
    );
  });

  it('is drawn at full size without any animation when the system asks for less motion', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    const timing = jest.spyOn(Animated, 'timing');
    const { segments } = await demoSegments();

    await renderUi(<VerdictStrip segments={segments} />);
    await act(async () => {});

    expect(timing).not.toHaveBeenCalled();
  });
});
