import { Pressable, StyleSheet } from 'react-native';

import { usePreferences } from '@/lib/preferences';
import { Icon, Text, colors, isHovered, layout, radius, space } from '@/ui';

/** Hides the user's own money amounts, for reading in public. Percentages and market prices stay. */
export function HideAmountsButton({ showLabel }: { showLabel: boolean }) {
  const { preferences, toggleHideAmounts } = usePreferences();
  const hidden = preferences.hideAmounts;
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel="Hide amounts"
      aria-checked={hidden}
      onPress={toggleHideAmounts}
      style={(state) => [
        styles.button,
        hidden ? styles.on : styles.off,
        isHovered(state) && !hidden && styles.hover,
      ]}
    >
      <Icon
        name={hidden ? 'eye-off-outline' : 'eye-outline'}
        size={20}
        color={hidden ? colors.white : colors.ink2}
      />
      {showLabel ? (
        <Text variant="smallStrong" style={{ color: hidden ? colors.white : colors.ink2 }}>
          Hide amounts
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    minHeight: layout.minTarget,
    minWidth: layout.minTarget,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  off: { borderColor: colors.controlBorder, backgroundColor: 'transparent' },
  on: { borderColor: colors.ink, backgroundColor: colors.ink },
  hover: { backgroundColor: colors.paper },
});
