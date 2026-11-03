import { Platform } from 'react-native';
import { MD3LightTheme, configureFonts, type MD3Theme } from 'react-native-paper';

import { colors, fonts, radius } from './tokens';

const materialFamily = Platform.select({ web: fonts.ui, ios: 'System', default: 'sans-serif' });

/**
 * Material 3 colour roles carrying the product's tokens. Primary is ink, not teal: teal, amber and crimson are
 * reserved for verdicts. Elevation is expressed with hairlines and the paper/sheet step, not with shadows.
 */
export const paperTheme: MD3Theme = {
  ...MD3LightTheme,
  roundness: radius.md / 4,
  fonts: configureFonts({ config: { fontFamily: materialFamily } }),
  colors: {
    ...MD3LightTheme.colors,
    primary: colors.ink,
    onPrimary: colors.white,
    primaryContainer: colors.slateBg,
    onPrimaryContainer: colors.ink,
    secondary: colors.blue,
    onSecondary: colors.white,
    secondaryContainer: colors.slateBg,
    onSecondaryContainer: colors.ink,
    tertiary: colors.blue,
    onTertiary: colors.white,
    tertiaryContainer: colors.slateBg,
    onTertiaryContainer: colors.ink,
    error: colors.crimson,
    onError: colors.white,
    errorContainer: colors.crimsonBg,
    onErrorContainer: colors.crimson,
    background: colors.paper,
    onBackground: colors.ink,
    surface: colors.sheet,
    onSurface: colors.ink,
    surfaceVariant: colors.slateBg,
    onSurfaceVariant: colors.ink2,
    outline: colors.controlBorder,
    outlineVariant: colors.rule,
    inverseSurface: colors.ink,
    inverseOnSurface: colors.white,
    inversePrimary: colors.rule,
    surfaceDisabled: 'rgba(15, 30, 43, 0.12)',
    onSurfaceDisabled: 'rgba(15, 30, 43, 0.38)',
    backdrop: 'rgba(15, 30, 43, 0.4)',
    elevation: {
      level0: 'transparent',
      level1: colors.sheet,
      level2: colors.sheet,
      level3: colors.sheet,
      level4: colors.sheet,
      level5: colors.sheet,
    },
  },
};

/**
 * The theme for what the system asks of motion. Paper times its own animations (snackbar, dialog, the floating label of
 * a field) by the scale of its theme, so a scale of zero is how they are turned off.
 */
export function themeFor(reducedMotion: boolean): MD3Theme {
  return reducedMotion
    ? { ...paperTheme, animation: { ...paperTheme.animation, scale: 0 } }
    : paperTheme;
}
