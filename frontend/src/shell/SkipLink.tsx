import { useState } from 'react';
import { Platform, Pressable, StyleSheet } from 'react-native';

import { Text, colors, radius, space } from '@/ui';

export const MAIN_CONTENT_ID = 'main-content';

/** The first thing a keyboard user can reach on the web: jumps past the navigation to the screen itself. */
export function SkipLink() {
  const [focused, setFocused] = useState(false);
  if (Platform.OS !== 'web') {
    return null;
  }
  return (
    <Pressable
      accessibilityRole="link"
      onPress={() => document.getElementById(MAIN_CONTENT_ID)?.focus()}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={[styles.link, focused ? styles.shown : styles.hidden]}
    >
      <Text variant="smallStrong" tone="inverse">
        Skip to main content
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  link: {
    position: 'absolute',
    left: space.sm,
    zIndex: 100,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.ink,
  },
  hidden: { top: -200 },
  shown: { top: space.sm },
});
