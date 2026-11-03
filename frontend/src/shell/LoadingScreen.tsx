import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { useAfter } from '@/lib/useAfter';
import { Text, colors, space } from '@/ui';

/** A wait this long is no longer "a moment": a cold backend takes about this long to start. */
export const SLOW_AFTER_MS = 6_000;

export interface LoadingScreenProps {
  label?: string;
  /** What to say when the wait runs long. Without it the screen stays as it is, however long it takes. */
  slowHint?: string;
}

/** Shown while the session or the profile is being read, before there is anything of the user's to show. */
export function LoadingScreen({
  label = 'Loading Portfolio Signals',
  slowHint,
}: LoadingScreenProps) {
  const slow = useAfter(SLOW_AFTER_MS);
  return (
    <View style={styles.screen}>
      <View
        accessible
        accessibilityLabel={label}
        accessibilityState={{ busy: true }}
        aria-busy
        style={styles.busy}
      >
        {/* The system face: the heading font may still be loading, and the name must not change shape when it arrives. */}
        <Text variant="bodyStrong">Portfolio Signals</Text>
        <ActivityIndicator color={colors.ink} />
      </View>
      {/* The live region is always there, so that a screen reader announces the text when it arrives. */}
      <View role="status" accessibilityLiveRegion="polite" style={styles.hint} testID="slow-hint">
        {slow && slowHint ? (
          <Text variant="small" tone="muted" style={styles.hintText}>
            {slowHint}
          </Text>
        ) : null}
      </View>
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
  busy: { alignItems: 'center', gap: space.lg },
  hint: { minHeight: 40, paddingHorizontal: space.xl },
  hintText: { maxWidth: 360, textAlign: 'center' },
});
