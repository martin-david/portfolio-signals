import { Text as NativeText, type TextProps as NativeTextProps } from 'react-native';

import { compactTypeScale, toneColor, typeScale, type TextTone, type TextVariant } from './tokens';
import { useBreakpoint } from './useBreakpoint';

export interface TextProps extends NativeTextProps {
  variant?: TextVariant;
  tone?: TextTone;
}

/** Text in the product's type scale. Numbers are tabular everywhere, and text follows the system font size. */
export function Text({
  variant = 'body',
  tone = 'ink',
  style,
  maxFontSizeMultiplier,
  ...rest
}: TextProps) {
  const compact = useBreakpoint() === 'compact' ? compactTypeScale[variant] : undefined;
  return (
    <NativeText
      {...rest}
      maxFontSizeMultiplier={maxFontSizeMultiplier ?? 2}
      style={[typeScale[variant], compact, { color: toneColor[tone] }, style]}
    />
  );
}

export interface HeadingProps extends TextProps {
  /** Heading level for assistive technology (1 is the screen title). */
  level?: 1 | 2 | 3 | 4;
}

export function Heading({ level = 2, variant, ...rest }: HeadingProps) {
  const fallback: TextVariant =
    level === 1 ? 'display' : level === 2 ? 'title' : level === 3 ? 'heading' : 'subheading';
  return (
    <Text accessibilityRole="header" aria-level={level} variant={variant ?? fallback} {...rest} />
  );
}
