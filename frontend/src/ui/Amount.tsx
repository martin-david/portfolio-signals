import { usePreferences } from '@/lib/preferences';
import { formatMoney, formatSignedMoney } from '@/lib/format';

import { Text, type TextProps } from './Text';

export const HIDDEN_AMOUNT = '\u2022\u2022\u2022\u2022';

/** True when the user asked to hide their own amounts. */
export function useHideAmounts(): boolean {
  return usePreferences().preferences.hideAmounts;
}

export interface AmountProps extends Omit<TextProps, 'children'> {
  value: number | null | undefined;
  currency?: string;
  /** Show +/\u2212 (gains and losses) instead of a plain amount. */
  signed?: boolean;
  decimals?: number;
}

/**
 * A money amount that belongs to the user. It is replaced by dots when the user hides amounts; percentages and market
 * prices are not amounts of the user's and stay visible everywhere.
 */
export function Amount({
  value,
  currency = 'USD',
  signed = false,
  decimals = 0,
  ...text
}: AmountProps) {
  const hidden = useHideAmounts();
  if (hidden) {
    return (
      <Text {...text} accessibilityLabel="Amount hidden">
        {HIDDEN_AMOUNT}
      </Text>
    );
  }
  return (
    <Text {...text}>
      {signed
        ? formatSignedMoney(value, currency, decimals)
        : formatMoney(value, currency, decimals)}
    </Text>
  );
}
