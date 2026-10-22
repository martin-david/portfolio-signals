import { StyleSheet, View } from 'react-native';

import type { PortfolioSnapshotSummaryDto } from '@/api/schema';
import { formatDateTime, formatNumber, plural } from '@/lib/format';
import { Amount, Text, colors, space } from '@/ui';

export interface SnapshotListProps {
  snapshots: readonly PortfolioSnapshotSummaryDto[];
}

/** The portfolio as eToro reported it at each sync. Only the latest one feeds the analysis. */
export function SnapshotList({ snapshots }: SnapshotListProps) {
  return (
    <View role="list" testID="snapshots">
      {snapshots.map((snapshot, index) => (
        <View
          key={snapshot.snapshotId}
          role="listitem"
          testID={`snapshot-${snapshot.snapshotId}`}
          style={styles.row}
        >
          <View style={styles.main}>
            <Text variant="bodyStrong">{formatDateTime(snapshot.takenAt)}</Text>
            <Text variant="small" tone="muted">
              {`${formatNumber(snapshot.positions)} ${plural(snapshot.positions, 'position')}${
                index === 0 ? ', the latest' : ''
              }`}
            </Text>
          </View>
          <Amount value={snapshot.totalValue} variant="bodyStrong" />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
    paddingVertical: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.rule,
  },
  main: { flex: 1, gap: space.xxs },
});
