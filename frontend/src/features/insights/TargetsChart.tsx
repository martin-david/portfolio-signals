import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Line, Rect } from 'react-native-svg';

import {
  TARGET_AXIS,
  axisX,
  describeTargets,
  targetMarks,
  type TargetRow,
} from '@/features/portfolio/charts';
import { formatPercent, formatSignedPercent } from '@/lib/format';
import { Text, colors, space, useBreakpoint } from '@/ui';

import { useMeasuredWidth } from './useMeasuredWidth';

const ROW_HEIGHT = 38;
const LABEL_WIDTH = 92;
const VALUES_WIDTH = 300;
const DOT = 5.5;
const DIAMOND = 10;

/** What the two marks mean. */
export function TargetsKey() {
  return (
    <View style={styles.key} testID="targets-key">
      <View style={styles.keyItem}>
        <View aria-hidden>
          <Svg width={14} height={14}>
            <Circle cx={7} cy={7} r={5.5} fill={colors.blue} />
          </Svg>
        </View>
        <Text variant="small" tone="muted">
          Average Street target
        </Text>
      </View>
      <View style={styles.keyItem}>
        <View aria-hidden>
          <Svg width={14} height={14}>
            <Rect
              x={2}
              y={2}
              width={10}
              height={10}
              fill={colors.orange}
              transform="rotate(45 7 7)"
            />
          </Svg>
        </View>
        <Text variant="small" tone="muted">
          AI-model target
        </Text>
      </View>
    </View>
  );
}

function Plot({ row, width }: { row: TargetRow; width: number }) {
  const marks = targetMarks(row, width);
  const middle = ROW_HEIGHT / 2;
  return (
    <Svg width={width} height={ROW_HEIGHT} testID={`plot-${row.symbol}`}>
      {marks.grid.map((line) => (
        <Line
          key={line.value}
          x1={line.x}
          x2={line.x}
          y1={0}
          y2={ROW_HEIGHT}
          stroke={line.value === 0 ? colors.ink2 : colors.rule}
          strokeWidth={line.value === 0 ? 1.5 : 1}
        />
      ))}
      {marks.ai === null ? null : (
        <Rect
          testID={`ai-${row.symbol}`}
          x={marks.ai - DIAMOND / 2}
          y={middle - DIAMOND / 2}
          width={DIAMOND}
          height={DIAMOND}
          fill={colors.orange}
          transform={`rotate(45 ${marks.ai} ${middle})`}
        />
      )}
      <Circle
        testID={`street-${row.symbol}`}
        cx={marks.street}
        cy={middle}
        r={DOT}
        fill={colors.blue}
      />
    </Svg>
  );
}

/** The scale above the plot: where the price is today, and what 50% above or below it looks like. */
function Axis({ width }: { width: number }) {
  return (
    <View style={styles.axis} aria-hidden>
      {TARGET_AXIS.ticks.map((value) => (
        <Text
          key={value}
          variant="caption"
          tone="subtle"
          numberOfLines={1}
          style={[styles.tick, { left: axisX(value, TARGET_AXIS, width) - 40 }]}
        >
          {value === 0 ? 'price today' : formatSignedPercent(value, 0)}
        </Text>
      ))}
    </View>
  );
}

export interface TargetsChartProps {
  rows: readonly TargetRow[];
}

/**
 * What the Street and the AI models think each stock is worth, as a percent above or below today's price: a dot for
 * the average analyst target, a diamond for the AI target. The plot is a picture; the text beside it says every number.
 */
export function TargetsChart({ rows }: TargetsChartProps) {
  const wide = useBreakpoint() !== 'compact';
  const [width, onLayout] = useMeasuredWidth();

  return (
    <View testID="targets-chart">
      <View style={styles.axisRow}>
        <View style={styles.label} />
        <View style={styles.plot} onLayout={onLayout} testID="targets-measure">
          {width > 0 ? <Axis width={width} /> : null}
        </View>
        {wide ? <View style={styles.values} /> : null}
      </View>
      <View role="list">
        {rows.map((row) => (
          <View
            key={row.symbol}
            role="listitem"
            accessible
            testID={`target-${row.symbol}`}
            style={styles.row}
          >
            <View style={styles.label}>
              <Text variant="bodyStrong">{row.symbol}</Text>
              <Text variant="caption" tone="subtle">
                {formatPercent(row.weightPct)}
              </Text>
            </View>
            <View style={styles.plot} aria-hidden>
              {width > 0 ? <Plot row={row} width={width} /> : null}
            </View>
            <Text variant="small" tone="muted" style={wide ? styles.values : styles.valuesBelow}>
              {describeTargets(row)}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  key: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xl },
  keyItem: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  axisRow: { flexDirection: 'row', alignItems: 'flex-end', height: 24, marginTop: space.sm },
  axis: { height: 20 },
  tick: { position: 'absolute', top: 0, width: 80, textAlign: 'center' },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    minHeight: ROW_HEIGHT,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.rule2,
  },
  label: { width: LABEL_WIDTH },
  plot: { flex: 1, minWidth: 120, height: ROW_HEIGHT },
  values: { width: VALUES_WIDTH, paddingLeft: space.lg },
  valuesBelow: { width: '100%', paddingLeft: LABEL_WIDTH, paddingBottom: space.xs },
});
