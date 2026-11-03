import { StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth';
import { Text, colors, gutterFor, layout, space, useBreakpoint } from '@/ui';

export const DEMO_NOTICE =
  'Demo data. Every company, holding and figure in this demo is fictional.';

/** In the demo, says so on every screen, so no figure is ever mistaken for the user's own. */
export function DemoNotice() {
  const { mode } = useAuth();
  const breakpoint = useBreakpoint();
  if (mode !== 'mock') {
    return null;
  }
  return (
    <View style={styles.band}>
      <View style={[styles.inner, { paddingHorizontal: gutterFor(breakpoint) }]}>
        <Text variant="caption" tone="muted">
          {DEMO_NOTICE}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  band: {
    backgroundColor: colors.slateBg,
    paddingVertical: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.rule,
  },
  inner: { width: '100%', maxWidth: layout.maxContentWidth, alignSelf: 'center' },
});
