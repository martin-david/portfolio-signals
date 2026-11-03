import type { ReactNode } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { colors, layout } from './tokens';
import { gutterFor, useBreakpoint } from './useBreakpoint';

export interface ScreenProps {
  children: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  /** Centres the content vertically when it is shorter than the window (sign-in). */
  centered?: boolean;
  testID?: string;
}

/** A scrolling screen on the paper ground. Content sits in Bands that centre themselves up to the maximum width. */
export function Screen({ children, refreshing, onRefresh, centered, testID }: ScreenProps) {
  return (
    <ScrollView
      testID={testID}
      style={styles.screen}
      contentContainerStyle={[styles.content, centered && styles.centered]}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        onRefresh ? (
          <RefreshControl refreshing={Boolean(refreshing)} onRefresh={onRefresh} />
        ) : undefined
      }
    >
      {children}
    </ScrollView>
  );
}

export interface BandProps {
  children: ReactNode;
  /** paper is the page ground, sheet is the white band the prototype uses to separate sections. */
  tone?: 'paper' | 'sheet';
  /** The first band of a screen has no rule above it. */
  first?: boolean;
  /** Vertical padding: roomy for reading sections, tight for tool bars. */
  padding?: 'tight' | 'normal' | 'roomy';
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

const verticalPadding = { tight: 12, normal: 32, roomy: 56 } as const;

export function Band({
  children,
  tone = 'paper',
  first = false,
  padding = 'normal',
  style,
  testID,
}: BandProps) {
  const breakpoint = useBreakpoint();
  const scale = breakpoint === 'compact' ? 0.7 : 1;
  const vertical = Math.round(verticalPadding[padding] * scale);
  return (
    <View
      testID={testID}
      style={[
        {
          backgroundColor: tone === 'sheet' ? colors.sheet : colors.paper,
          borderTopWidth: first ? 0 : StyleSheet.hairlineWidth,
          borderTopColor: colors.rule,
          paddingVertical: vertical,
        },
        style,
      ]}
    >
      <View style={[styles.inner, { paddingHorizontal: gutterFor(breakpoint) }]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  content: { flexGrow: 1 },
  centered: { justifyContent: 'center' },
  inner: { width: '100%', maxWidth: layout.maxContentWidth, alignSelf: 'center' },
});
