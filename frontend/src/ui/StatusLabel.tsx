import { StyleSheet, View } from 'react-native';

import { Icon } from './Icon';
import { Text } from './Text';
import { colors, space } from './tokens';

export type StatusTone = 'neutral' | 'positive' | 'warning' | 'danger';

const palette: Record<StatusTone, { color: string; icon: string }> = {
  neutral: { color: colors.ink2, icon: 'circle-outline' },
  positive: { color: colors.tealDark, icon: 'check-circle-outline' },
  warning: { color: colors.amber, icon: 'alert-outline' },
  danger: { color: colors.crimson, icon: 'alert-circle-outline' },
};

export interface StatusLabelProps {
  tone: StatusTone;
  children: string;
  /** Overrides the icon of the tone, for example a clock for "Queued". */
  icon?: string;
  testID?: string;
}

/** A state in a word and a glyph, coloured by tone. Colour never carries the meaning on its own. */
export function StatusLabel({ tone, children, icon, testID }: StatusLabelProps) {
  const style = palette[tone];
  return (
    <View testID={testID} style={styles.row}>
      <Icon name={icon ?? style.icon} size={18} color={style.color} />
      <Text variant="smallStrong" style={{ color: style.color }}>
        {children}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
});
