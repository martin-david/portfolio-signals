import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from './Text';
import { colors, layout, radius, space } from './tokens';

export interface ToggleProps {
  label: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  /** What turning it on does. */
  description?: string;
  testID?: string;
}

/**
 * The picture of the switch: filled with the thumb at the end when on, an outline with the thumb at the start when
 * off, so the state never rests on colour alone. It is drawn with views because a native checkbox would be a second,
 * unnamed tab stop on the web.
 */
function SwitchGraphic({ on }: { on: boolean }) {
  return (
    <View aria-hidden style={[styles.track, on ? styles.trackOn : styles.trackOff]}>
      <View style={[styles.thumb, on ? styles.thumbOn : styles.thumbOff]} />
    </View>
  );
}

/** A labelled on/off setting. The whole row is the control, so the target is large and the label is its name. */
export function Toggle({ label, value, onValueChange, description, testID }: ToggleProps) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityHint={description}
      aria-checked={value}
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
      <SwitchGraphic on={value} />
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
  track: {
    width: 44,
    height: 24,
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 2,
  },
  trackOff: { alignItems: 'flex-start', borderColor: colors.controlBorder },
  trackOn: { alignItems: 'flex-end', borderColor: colors.ink, backgroundColor: colors.ink },
  thumb: { marginHorizontal: 3, borderRadius: radius.pill },
  thumbOff: { width: 12, height: 12, backgroundColor: colors.controlBorder },
  thumbOn: { width: 16, height: 16, backgroundColor: colors.white },
});
