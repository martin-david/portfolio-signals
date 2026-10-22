import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radius, space } from './tokens';

export interface PanelProps {
  children: ReactNode;
  /** Inner padding; none lets rows run to the edge. */
  padding?: 'none' | 'normal' | 'roomy';
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

const paddings = { none: 0, normal: space.lg, roomy: space.xl } as const;

/** A white sheet with a hairline edge: the one container the product uses for a self-contained piece of content. */
export function Panel({ children, padding = 'normal', style, testID }: PanelProps) {
  return (
    <View testID={testID} style={[styles.panel, { padding: paddings[padding] }, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: colors.sheet,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.rule,
    borderRadius: radius.md,
  },
});
