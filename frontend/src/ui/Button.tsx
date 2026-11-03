import type { StyleProp, ViewStyle } from 'react-native';
import { Button as PaperButton } from 'react-native-paper';

import { Icon } from './Icon';
import { colors, fonts, layout, radius } from './tokens';

export type ButtonVariant = 'primary' | 'secondary' | 'quiet' | 'danger';

export interface ButtonProps {
  children: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  /** MaterialCommunityIcons name. The icon is decorative: the label says what the button does. */
  icon?: string;
  loading?: boolean;
  disabled?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

const modeFor: Record<ButtonVariant, 'contained' | 'outlined' | 'text'> = {
  primary: 'contained',
  secondary: 'outlined',
  danger: 'outlined',
  quiet: 'text',
};

const textColorFor: Record<ButtonVariant, string> = {
  primary: colors.white,
  secondary: colors.ink,
  danger: colors.crimson,
  quiet: colors.blue,
};

/** One button vocabulary for the whole product: ink-filled primary, outlined secondary, quiet text, danger outline. */
export function Button({
  children,
  onPress,
  variant = 'primary',
  icon,
  loading = false,
  disabled = false,
  accessibilityLabel,
  accessibilityHint,
  testID,
  style,
}: ButtonProps) {
  const outlined = variant === 'secondary' || variant === 'danger';
  return (
    <PaperButton
      mode={modeFor[variant]}
      icon={icon ? ({ size, color }) => <Icon name={icon} size={size} color={color} /> : undefined}
      loading={loading}
      disabled={disabled}
      onPress={loading ? undefined : onPress}
      buttonColor={variant === 'primary' ? colors.ink : undefined}
      textColor={textColorFor[variant]}
      accessibilityLabel={
        loading
          ? `${accessibilityLabel ?? children}, in progress`
          : (accessibilityLabel ?? children)
      }
      accessibilityHint={accessibilityHint}
      testID={testID}
      style={[
        { borderRadius: radius.md },
        outlined && { borderColor: variant === 'danger' ? colors.crimson : colors.controlBorder },
        style,
      ]}
      contentStyle={{ minHeight: layout.minTarget, paddingHorizontal: 4 }}
      labelStyle={{
        fontFamily: fonts.ui,
        fontSize: 14,
        lineHeight: 20,
        fontWeight: '600',
        letterSpacing: 0,
      }}
    >
      {children}
    </PaperButton>
  );
}
