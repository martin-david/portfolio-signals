import { useIsFocused } from 'expo-router';
import type { ReactElement } from 'react';
import { Platform, StyleSheet, View, type ViewStyle } from 'react-native';

// react-native-web understands visibility; the native style types do not list it.
const hidden = { visibility: 'hidden' } as unknown as ViewStyle;

/**
 * The tab navigator keeps every screen it has shown mounted. On the web the ones that are not current stay in the
 * page, covered by the current one: still in the tab order, and read by some screen readers. Hidden visibility takes
 * them out of both and, unlike display none, keeps their scroll position. Android detaches inactive screens itself.
 */
export function SceneVisibility({ children }: { children: ReactElement }) {
  const focused = useIsFocused();
  return (
    <View style={[styles.scene, Platform.OS === 'web' && !focused && hidden]}>{children}</View>
  );
}

const styles = StyleSheet.create({
  scene: { flex: 1 },
});
