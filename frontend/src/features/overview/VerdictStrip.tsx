import { useEffect, useId, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Platform,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import Svg, { Defs, Pattern, Rect } from 'react-native-svg';

import { describeStrip, type StripKey, type StripSegment } from '@/features/portfolio/strip';
import { formatPercent } from '@/lib/format';
import {
  Amount,
  Grid,
  Text,
  colors,
  gutterFor,
  layout,
  space,
  useBreakpoint,
  verdictFill,
  type Breakpoint,
} from '@/ui';

interface Fill {
  background: string;
  text: string;
  /** A segment that is not a verdict needs an edge to stand out from the page. */
  border?: string;
}

const fills: Record<StripKey, Fill> = {
  ...verdictFill,
  cash: { background: colors.sheet, text: colors.ink, border: colors.controlBorder },
};

/** The words inside a wide segment; the legend carries the full names. */
const barLabel: Record<StripKey, string> = {
  size: 'Hold, review size',
  hold: 'Hold',
  watch: 'Watch',
  review: 'Review',
  nodata: 'No data',
  copy: 'Copy',
  cash: 'Cash',
};

/** Rough width of a character of the 12 px condensed face with its letter spacing, and of a segment's own padding. */
const CHAR_WIDTH = 7;
const SEGMENT_PADDING = 20;

/**
 * What fits inside a segment: its name and share, or just the share when the name would be cut off, or nothing at all.
 * The legend below the bar always has the full text.
 */
export function stripLabel(segment: StripSegment, barWidth: number): string | null {
  const width = (segment.pct / 100) * barWidth;
  const share = `${segment.pct.toFixed(0)}%`;
  const full = `${barLabel[segment.key]} ${share}`;
  if (width >= full.length * CHAR_WIDTH + SEGMENT_PADDING) {
    return full;
  }
  return width >= share.length * CHAR_WIDTH + SEGMENT_PADDING ? share : null;
}

const BAR_HEIGHT = 60;
const GROW_MS = 900;

const legendColumns: Record<Breakpoint, number> = { compact: 1, medium: 2, wide: 3 };

/** Diagonal stripes tell what is not assessed (copy trading) from the verdict "No data", which is the same grey. */
function Hatch({ pitch }: { pitch: number }) {
  const id = `hatch-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  return (
    <View aria-hidden style={StyleSheet.absoluteFill}>
      <Svg width="100%" height="100%">
        <Defs>
          <Pattern
            id={id}
            width={pitch}
            height={pitch}
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <Rect width={2} height={pitch} fill="rgba(255,255,255,0.32)" />
          </Pattern>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}

/**
 * The bar grows in from the left once, unless the system asks for less motion. The preference is read before anything
 * moves, so that a person who asked for no animation never sees it begin.
 */
function useGrowIn(): Animated.Value {
  const [progress] = useState(() => new Animated.Value(0));
  useEffect(() => {
    let mounted = true;
    let animation: Animated.CompositeAnimation | undefined;
    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((reduced) => {
        if (!mounted) {
          return;
        }
        if (reduced) {
          progress.setValue(1);
          return;
        }
        animation = Animated.timing(progress, {
          toValue: 1,
          duration: GROW_MS,
          easing: Easing.out(Easing.cubic),
          // The web has no native animation module; asking for one only logs a warning.
          useNativeDriver: Platform.OS !== 'web',
        });
        animation.start();
      });
    return () => {
      mounted = false;
      animation?.stop();
    };
  }, [progress]);
  return progress;
}

function Segment({ segment, barWidth }: { segment: StripSegment; barWidth: number }) {
  const fill = fills[segment.key];
  const label = stripLabel(segment, barWidth);
  return (
    <View
      testID={`strip-segment-${segment.key}`}
      style={[
        styles.segment,
        {
          flexGrow: segment.pct,
          backgroundColor: fill.background,
          borderWidth: fill.border ? 1 : 0,
          borderColor: fill.border,
        },
      ]}
    >
      {segment.key === 'copy' ? <Hatch pitch={7} /> : null}
      {label ? (
        <Text
          variant="chip"
          numberOfLines={1}
          style={[{ color: fill.text }, segment.key === 'copy' && styles.hatchedLabel]}
        >
          {label}
        </Text>
      ) : null}
    </View>
  );
}

function Swatch({ segmentKey }: { segmentKey: StripKey }) {
  const fill = fills[segmentKey];
  return (
    <View
      aria-hidden
      style={[
        styles.swatch,
        { backgroundColor: fill.background, borderColor: fill.border ?? fill.background },
      ]}
    >
      {segmentKey === 'copy' ? <Hatch pitch={6} /> : null}
    </View>
  );
}

export interface VerdictStripProps {
  segments: readonly StripSegment[];
  currency?: string;
}

/**
 * The account value split by verdict, as one bar and a legend that names what is in each part. The bar is a picture
 * with a spoken summary; the legend is the text that carries everything it shows, including the amounts.
 */
export function VerdictStrip({ segments, currency = 'USD' }: VerdictStripProps) {
  const breakpoint = useBreakpoint();
  const { width } = useWindowDimensions();
  const progress = useGrowIn();
  // The bands centre their content up to a maximum width, inside the page gutters.
  const barWidth = Math.min(width, layout.maxContentWidth) - 2 * gutterFor(breakpoint);

  return (
    <View testID="verdict-strip" style={styles.strip}>
      <Animated.View
        testID="strip-bar"
        accessible
        accessibilityRole="image"
        accessibilityLabel={`Account value split by verdict: ${describeStrip(segments)}`}
        style={[styles.bar, { transformOrigin: 'left center', transform: [{ scaleX: progress }] }]}
      >
        {segments.map((segment) => (
          <Segment key={segment.key} segment={segment} barWidth={barWidth} />
        ))}
      </Animated.View>

      <Grid
        list
        columns={legendColumns[breakpoint]}
        gap={breakpoint === 'wide' ? space.xxl + space.sm : space.xl}
        testID="strip-legend"
      >
        {segments.map((segment) => (
          <View key={segment.key} testID={`legend-${segment.key}`} style={styles.legendItem}>
            <View style={styles.swatchBox}>
              <Swatch segmentKey={segment.key} />
            </View>
            <View style={styles.legendText}>
              <Text variant="smallStrong">{segment.name}</Text>
              <Text variant="small" tone="subtle">
                {segment.detail}
              </Text>
            </View>
            <View style={styles.legendFigures}>
              <Text variant="small">{formatPercent(segment.pct)}</Text>
              <Amount value={segment.value} currency={currency} variant="small" tone="subtle" />
            </View>
          </View>
        ))}
      </Grid>
    </View>
  );
}

const styles = StyleSheet.create({
  strip: { gap: space.lg },
  bar: { flexDirection: 'row', gap: 2, height: BAR_HEIGHT },
  segment: {
    flexBasis: 0,
    flexShrink: 1,
    minWidth: 3,
    justifyContent: 'flex-start',
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  legendItem: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm, paddingVertical: 6 },
  // Text on stripes loses contrast, so the label of a hatched segment sits on a solid ground of its own.
  hatchedLabel: {
    alignSelf: 'flex-start',
    backgroundColor: colors.slate,
    borderRadius: 2,
    marginLeft: -4,
    paddingHorizontal: 4,
  },
  swatchBox: { paddingTop: 3 },
  swatch: { width: 14, height: 14, borderRadius: 2, borderWidth: 1, overflow: 'hidden' },
  legendText: { flex: 1, gap: 2 },
  legendFigures: { alignItems: 'flex-end', gap: 2 },
});
