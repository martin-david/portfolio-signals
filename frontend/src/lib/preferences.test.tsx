import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, screen } from '@testing-library/react-native';
import { Pressable, Text } from 'react-native';

import { renderUi } from '@/test/renderUi';

import {
  DEFAULT_PREFERENCES,
  PREFERENCES_KEY,
  parsePreferences,
  usePreferences,
} from './preferences';

describe('parsePreferences', () => {
  it('falls back to the defaults for missing, corrupt or unexpected storage', () => {
    for (const raw of [
      null,
      undefined,
      '',
      'not json',
      '42',
      'null',
      '[]',
      '{"hideAmounts":"yes"}',
    ]) {
      expect(parsePreferences(raw)).toEqual(DEFAULT_PREFERENCES);
    }
  });

  it('reads a stored choice', () => {
    expect(parsePreferences('{"hideAmounts":true}')).toEqual({ hideAmounts: true });
    expect(parsePreferences('{"hideAmounts":false,"other":1}')).toEqual({ hideAmounts: false });
  });
});

function Probe() {
  const { preferences, ready, toggleHideAmounts } = usePreferences();
  return (
    <Pressable onPress={toggleHideAmounts} accessibilityRole="button" accessibilityLabel="toggle">
      <Text>{`${ready ? 'ready' : 'loading'}:${preferences.hideAmounts ? 'hidden' : 'shown'}`}</Text>
    </Pressable>
  );
}

describe('PreferencesProvider', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('starts with amounts shown and persists a change', async () => {
    await renderUi(<Probe />);

    expect(await screen.findByText('ready:shown')).toBeOnTheScreen();

    await fireEvent.press(screen.getByLabelText('toggle'));

    expect(await screen.findByText('ready:hidden')).toBeOnTheScreen();
    expect(JSON.parse((await AsyncStorage.getItem(PREFERENCES_KEY)) ?? '{}')).toEqual({
      hideAmounts: true,
    });
  });

  it('restores the stored choice', async () => {
    await AsyncStorage.setItem(PREFERENCES_KEY, JSON.stringify({ hideAmounts: true }));

    await renderUi(<Probe />);

    expect(await screen.findByText('ready:hidden')).toBeOnTheScreen();
  });
});
