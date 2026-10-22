import { Pressable, StyleSheet, View } from 'react-native';
import { Switch } from 'react-native-paper';

import { Text } from './Text';
import { colors, layout, space } from './tokens';

export interface ToggleProps {
  label: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  /** What turning it on does. */
  description?: string;
  testID?: string;
}

/** A labelled on/off setting. The whole row is the control, so the target is large and the label is its name. */
export function Toggle({ label, value, onValueChange, description, testID }: ToggleProps) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityHint={description}
      accessibilityState={{ checked: value }}
      onPress={() => onValueChange(!value)}
      style={styles.row}
    >
      <View style={styles.text}>
        <Text variant="bodyStrong">{label}</Text>
        {description ? (
          <Text variant="small" tone="muted">
            {description}
          </Text>
        ) : null}
      </View>
      <View pointerEvents="none" aria-hidden>
        <Switch value={value} color={colors.ink} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.lg,
    minHeight: layout.minTarget,
    paddingVertical: space.sm,
  },
  text: { flex: 1, gap: space.xxs },
});
