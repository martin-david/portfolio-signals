import { StyleSheet, View } from 'react-native';

import type { SignalCell } from '@/features/portfolio/signals';
import { RangeBar, Text, colors, space } from '@/ui';

/** One signal in the instrument panel: where it sits on its scale and the reading beneath, or why it is missing. */
export function SignalCellView({ cell }: { cell: SignalCell }) {
  if (!cell.present) {
    return (
      <Text variant="caption" tone="subtle" testID={`signal-${cell.key}`}>
        {cell.missing}
      </Text>
    );
  }
  return (
    <View style={styles.cell} testID={`signal-${cell.key}`}>
      <RangeBar
        value={cell.value}
        min={cell.min}
        max={cell.max}
        zone={cell.zone}
        ticks={cell.ticks}
        zero={cell.zero}
        tone={cell.tone}
        label={cell.spoken}
      />
      <Text variant="caption" tone="muted" numberOfLines={1}>
        {cell.text}
      </Text>
    </View>
  );
}

/** One signal on a holding's own page: its name, the scale, the reading in words, and when absent, why. */
export function SignalRow({ cell }: { cell: SignalCell }) {
  return (
    <View role="listitem" style={styles.row} testID={`signal-row-${cell.key}`}>
      <Text variant="smallStrong" style={styles.heading}>
        {cell.heading}
      </Text>
      {cell.present ? (
        <View style={styles.reading}>
          <RangeBar
            value={cell.value}
            min={cell.min}
            max={cell.max}
            zone={cell.zone}
            ticks={cell.ticks}
            zero={cell.zero}
            tone={cell.tone}
            width={180}
            height={22}
            label={cell.spoken}
          />
          <Text variant="small">{cell.text}</Text>
        </View>
      ) : (
        <Text variant="small" tone="subtle" style={styles.reading}>
          {`Not available: ${cell.missing}`}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  cell: { gap: 2 },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: space.lg,
    rowGap: space.xs,
    paddingVertical: space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.rule2,
  },
  heading: { width: 140 },
  reading: { flexDirection: 'row', alignItems: 'center', gap: space.md, flexShrink: 1 },
});
