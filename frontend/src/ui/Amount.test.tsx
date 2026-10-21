import AsyncStorage from '@react-native-async-storage/async-storage';
import { screen } from '@testing-library/react-native';

import { PREFERENCES_KEY } from '@/lib/preferences';
import { renderUi } from '@/test/renderUi';

import { Amount, HIDDEN_AMOUNT } from './Amount';

describe('Amount', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('shows the amount in its currency', async () => {
    await renderUi(<Amount value={12345} />);

    expect(await screen.findByText('$12,345')).toBeOnTheScreen();
  });

  it('signs gains and losses', async () => {
    await renderUi(<Amount value={-250.4} signed currency="EUR" />);

    expect(await screen.findByText('\u2212\u20ac250')).toBeOnTheScreen();
  });

  it('replaces the amount with dots when the user hides amounts', async () => {
    await AsyncStorage.setItem(PREFERENCES_KEY, JSON.stringify({ hideAmounts: true }));

    await renderUi(<Amount value={12345} />);

    expect(await screen.findByText(HIDDEN_AMOUNT)).toBeOnTheScreen();
    expect(screen.getByLabelText('Amount hidden')).toBeOnTheScreen();
    expect(screen.queryByText('$12,345')).toBeNull();
  });
});
