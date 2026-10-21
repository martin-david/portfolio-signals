import { useFonts } from 'expo-font';
import { BarlowSemiCondensed_600SemiBold } from '@expo-google-fonts/barlow-semi-condensed';

import { fonts } from './tokens';

/** Loads the heading and figure face. Resolves true when it is ready, or when it failed (the fallback is used). */
export function useAppFonts(): boolean {
  const [loaded, error] = useFonts({
    [fonts.dataFile]: BarlowSemiCondensed_600SemiBold,
  });
  return loaded || error !== null;
}
