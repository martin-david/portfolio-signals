import { useEffect, useState } from 'react';
import {
  Animated,
  StyleSheet,
  View,
  type DimensionValue,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { colors, radius, space } from './tokens';
import { useReducedMotion } from './useReducedMotion';

/** A placeholder for content that is still loading. It pulses gently unless the system asks for less motion. */
export function SkeletonBlock({
  width = '100%',
  height = 16,
  style,
}: {
  width?: DimensionValue;
  height?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const reduced = useReducedMotion();
  const [opacity] = useState(() => new Animated.Value(1));

  useEffect(() => {
    if (reduced) {
      opacity.setValue(1);
      return undefined;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.45, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [reduced, opacity]);

  return (
    <Animated.View
      importantForAccessibility="no-hide-descendants"
      style={[
        { width, height, opacity, backgroundColor: colors.rule2, borderRadius: radius.sm },
        style,
      ]}
    />
  );
}

/** Wraps skeletons so that assistive technology announces one busy region instead of many empty boxes. */
export function LoadingRegion({
  label = 'Loading',
  children,
  testID,
}: {
  label?: string;
  children: React.ReactNode;
  testID?: string;
}) {
  return (
    <View
      testID={testID}
      accessible
      accessibilityLabel={label}
      accessibilityState={{ busy: true }}
      aria-busy
      style={styles.region}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  region: { gap: space.md },
});
