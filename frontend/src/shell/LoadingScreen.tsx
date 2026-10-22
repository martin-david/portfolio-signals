import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Text, colors, space } from '@/ui';

/** Shown while the session or the profile is being read, before there is anything of the user's to show. */
export function LoadingScreen({ label = 'Loading Portfolio Signals' }: { label?: string }) {
  return (
    <View
      accessible
      accessibilityLabel={label}
      accessibilityState={{ busy: true }}
      aria-busy
      style={styles.screen}
    >
      {/* The system face: the heading font may still be loading, and the name must not change shape when it arrives. */}
      <Text variant="bodyStrong">Portfolio Signals</Text>
      <ActivityIndicator color={colors.ink} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.lg,
    backgroundColor: colors.paper,
  },
});
