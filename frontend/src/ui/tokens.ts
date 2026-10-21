/**
 * Design tokens. The world is the prototype's instrument-panel report (prototype/report/style.css): cool paper
 * grounds, blue-black ink, hairline rules, one condensed DIN-like face for headings and figures. Teal, amber and
 * crimson mean hold, watch and review and nothing else, always with a glyph and a word; interface chrome stays ink
 * and blue so that colour never competes with a verdict.
 */
import { Platform, type TextStyle } from 'react-native';

export const colors = {
  paper: '#edf0f2',
  sheet: '#ffffff',
  sheetSunken: '#f7f9fa',
  ink: '#0f1e2b',
  ink2: '#3f5060',
  ink3: '#566778',
  rule: '#cfd8de',
  rule2: '#e3e9ed',
  /** Boundary of inputs and other controls: at least 3:1 against the sheet. */
  controlBorder: '#6f8295',
  teal: '#0d7467',
  tealDark: '#0a574d',
  tealBg: '#dcf0ec',
  amber: '#8a5606',
  amberBg: '#faecd2',
  crimson: '#a4221a',
  crimsonBg: '#f8dedb',
  /** Darker than the prototype's #6f8295 so that white text on it reaches AA. */
  slate: '#5b6e80',
  slateBg: '#e5eaef',
  blue: '#245384',
  orange: '#b34a08',
  white: '#ffffff',
} as const;

export type VerdictKey = 'size' | 'hold' | 'watch' | 'review' | 'nodata' | 'copy';

/** Fill of a verdict in the account strip, with the text colour that sits on it. */
export const verdictFill: Record<VerdictKey, { background: string; text: string }> = {
  size: { background: colors.tealDark, text: colors.white },
  hold: { background: colors.teal, text: colors.white },
  watch: { background: colors.amber, text: colors.white },
  review: { background: colors.crimson, text: colors.white },
  nodata: { background: colors.slate, text: colors.white },
  copy: { background: colors.slate, text: colors.white },
};

/** Chip colours of a verdict. */
export const verdictChip: Record<
  'hold' | 'watch' | 'review' | 'nodata',
  { background: string; text: string }
> = {
  hold: { background: colors.tealBg, text: colors.tealDark },
  watch: { background: colors.amberBg, text: colors.amber },
  review: { background: colors.crimsonBg, text: colors.crimson },
  nodata: { background: colors.slateBg, text: colors.ink2 },
};

export const space = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  huge: 48,
  giant: 72,
} as const;

export const radius = { sm: 3, md: 4, pill: 999 } as const;

export const layout = {
  maxContentWidth: 1280,
  /** Below this width the interface uses the compact layout (bottom navigation, signals as text). */
  compactBelow: 600,
  /** From this width the top navigation bar and the full holdings panel are used. */
  wideFrom: 860,
  /** Material guidance: 48 dp touch targets. */
  minTarget: 48,
} as const;

const dataFamily = Platform.select({
  web: '"BarlowSemiCondensed_600SemiBold", "Bahnschrift SemiCondensed", "Arial Narrow", sans-serif',
  default: 'BarlowSemiCondensed_600SemiBold',
});

const systemWebStack =
  'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

export const fonts = {
  /** Labels, buttons and body text use the platform's own face (Roboto on Android). */
  ui: Platform.select({ web: systemWebStack, default: undefined }),
  /** Headings, figures and chips. Loaded with expo-font; see src/ui/useAppFonts. */
  data: dataFamily,
  dataFile: 'BarlowSemiCondensed_600SemiBold',
} as const;

export type TextVariant =
  | 'display'
  | 'title'
  | 'heading'
  | 'subheading'
  | 'body'
  | 'bodyStrong'
  | 'small'
  | 'smallStrong'
  | 'caption'
  | 'label'
  | 'figure'
  | 'chip';

const tabular: TextStyle['fontVariant'] = ['tabular-nums'];

/** A fixed scale (about 1.2 between steps), not fluid: product UI is read at a steady size. */
export const typeScale: Record<TextVariant, TextStyle> = {
  display: {
    fontFamily: fonts.data,
    fontSize: 40,
    lineHeight: 44,
    letterSpacing: -0.4,
    fontVariant: tabular,
  },
  title: { fontFamily: fonts.data, fontSize: 26, lineHeight: 30, fontVariant: tabular },
  heading: { fontFamily: fonts.data, fontSize: 20, lineHeight: 24, fontVariant: tabular },
  subheading: { fontFamily: fonts.data, fontSize: 17, lineHeight: 22, fontVariant: tabular },
  body: { fontFamily: fonts.ui, fontSize: 16, lineHeight: 24, fontVariant: tabular },
  bodyStrong: {
    fontFamily: fonts.ui,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '600',
    fontVariant: tabular,
  },
  small: { fontFamily: fonts.ui, fontSize: 14, lineHeight: 20, fontVariant: tabular },
  smallStrong: {
    fontFamily: fonts.ui,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    fontVariant: tabular,
  },
  caption: { fontFamily: fonts.ui, fontSize: 13, lineHeight: 18, fontVariant: tabular },
  label: {
    fontFamily: fonts.ui,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
    fontVariant: tabular,
  },
  figure: { fontFamily: fonts.data, fontSize: 22, lineHeight: 24, fontVariant: tabular },
  chip: {
    fontFamily: fonts.data,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.3,
    fontVariant: tabular,
  },
};

/** The two headline sizes shrink on compact screens. */
export const compactTypeScale: Partial<Record<TextVariant, TextStyle>> = {
  display: { fontSize: 30, lineHeight: 34, letterSpacing: -0.3 },
  title: { fontSize: 23, lineHeight: 27 },
};

export type TextTone =
  'ink' | 'muted' | 'subtle' | 'inverse' | 'link' | 'positive' | 'warning' | 'danger';

export const toneColor: Record<TextTone, string> = {
  ink: colors.ink,
  muted: colors.ink2,
  subtle: colors.ink3,
  inverse: colors.white,
  link: colors.blue,
  positive: colors.tealDark,
  warning: colors.amber,
  danger: colors.crimson,
};
