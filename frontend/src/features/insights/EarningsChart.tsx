import { StyleSheet, View } from 'react-native';
import Svg, { Line, Rect, Text as SvgText } from 'react-native-svg';

import {
  LABEL_PADDING,
  earningsScaleMax,
  earningsSegments,
  earningsTicks,
  type EarningsDay,
} from '@/features/portfolio/charts';
import { formatDayLabel, formatPercent } from '@/lib/format';
import { Text, colors, fonts, space, useBreakpoint } from '@/ui';

import { useMeasuredWidth } from './useMeasuredWidth';

const ROW_HEIGHT = 40;
const BAR_TOP = 8;
const BAR_HEIGHT = 24;
const LABEL_WIDTH = 92;
const VALUES_WIDTH = 300;

function Bar({ day, scaleMax, width }: { day: EarningsDay; scaleMax: number; width: number }) {
  const segments = earningsSegments(day, scaleMax, width);
  return (
    <Svg width={width} height={ROW_HEIGHT} testID={`bar-${day.date}`}>
      {earningsTicks(scaleMax).map((tick) => (
        <Line
          key={tick}
          x1={(tick / scaleMax) * width}
          x2={(tick / scaleMax) * width}
          y1={0}
          y2={ROW_HEIGHT}
          stroke={colors.rule}
          strokeWidth={1}
        />
      ))}
      {segments.map((segment) => (
        <Rect
          key={segment.symbol}
          testID={`segment-${day.date}-${segment.symbol}`}
          x={segment.x}
          y={BAR_TOP}
          width={segment.width}
          height={BAR_HEIGHT}
          fill={colors.blue}
        />
      ))}
      {segments
        .filter((segment) => segment.labelled)
        .map((segment) => (
          <SvgText
            key={segment.symbol}
            testID={`label-${day.date}-${segment.symbol}`}
            x={segment.x + LABEL_PADDING}
            y={BAR_TOP + 16}
            fill={colors.white}
            fontSize={12}
            fontFamily={fonts.data}
          >
            {segment.symbol}
          </SvgText>
        ))}
    </Svg>
  );
}

function Axis({ scaleMax, width }: { scaleMax: number; width: number }) {
  return (
    <View style={styles.axis} aria-hidden>
      {earningsTicks(scaleMax).map((tick, index, ticks) => (
        <Text
          key={tick}
          variant="caption"
          tone="subtle"
          numberOfLines={1}
          style={[
            styles.tick,
            // The first label starts at the edge and the last ends at it, so that neither is cut off.
            index === 0
              ? { left: 0, textAlign: 'left' }
              : { left: (tick / scaleMax) * width - 90, textAlign: 'right' },
          ]}
        >
          {index === ticks.length - 1 ? `${tick}% of account` : `${tick}%`}
        </Text>
      ))}
    </View>
  );
}

export interface EarningsChartProps {
  days: readonly EarningsDay[];
}

/**
 * The share of the account reporting each day, one bar per date, divided by holding and as wide as its share. The bars
 * are a picture; the text beside each says the date, the total and the holdings.
 */
export function EarningsChart({ days }: EarningsChartProps) {
  const wide = useBreakpoint() !== 'compact';
  const [width, onLayout] = useMeasuredWidth();
  const scaleMax = earningsScaleMax(days);

  return (
    <View testID="earnings-chart">
      <View style={styles.axisRow}>
        <View style={styles.label} />
        <View style={styles.plot} onLayout={onLayout} testID="earnings-measure">
          {width > 0 ? <Axis scaleMax={scaleMax} width={width} /> : null}
        </View>
        {wide ? <View style={styles.values} /> : null}
      </View>
      <View role="list">
        {days.map((day) => (
          <View
            key={day.date}
            role="listitem"
            accessible
            testID={`earnings-${day.date}`}
            style={styles.row}
          >
            <View style={styles.label}>
              <Text variant="bodyStrong">{formatDayLabel(day.date)}</Text>
            </View>
            <View style={styles.plot} aria-hidden>
              {width > 0 ? <Bar day={day} scaleMax={scaleMax} width={width} /> : null}
            </View>
            <Text variant="small" tone="muted" style={wide ? styles.values : styles.valuesBelow}>
              {`${formatPercent(day.totalPct)} \u00b7 ${day.items.map((item) => item.symbol).join(', ')}`}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  axisRow: { flexDirection: 'row', alignItems: 'flex-end', height: 24, marginTop: space.sm },
  axis: { height: 20 },
  tick: { position: 'absolute', top: 0, width: 90 },
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
