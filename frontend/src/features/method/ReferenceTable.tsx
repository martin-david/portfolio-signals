import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Panel, Text, colors, space, useBreakpoint } from '@/ui';

export interface ReferenceColumn<Row> {
  label: string;
  /** Relative width among the columns. */
  flex: number;
  render: (row: Row) => ReactNode;
}

export interface ReferenceTableProps<Row> {
  /** What the table is, for assistive technology. */
  label: string;
  columns: readonly ReferenceColumn<Row>[];
  rows: readonly Row[];
  rowKey: (row: Row) => string;
  testID?: string;
}

function Cell({ children, strong }: { children: ReactNode; strong?: boolean }) {
  return typeof children === 'string' ? (
    <Text variant={strong ? 'bodyStrong' : 'small'}>{children}</Text>
  ) : (
    <>{children}</>
  );
}

/**
 * A small table of reference text. From the medium layout up it is a table with headings; on a phone each row becomes
 * a short card of "Label, then reading", because three columns of prose do not fit side by side.
 */
export function ReferenceTable<Row>({
  label,
  columns,
  rows,
  rowKey,
  testID,
}: ReferenceTableProps<Row>) {
  const compact = useBreakpoint() === 'compact';
  const rowId = (row: Row) => (testID ? `${testID}-${rowKey(row)}` : undefined);

  if (compact) {
    return (
      <Panel padding="none" testID={testID}>
        <View role="list" accessibilityLabel={label}>
          {rows.map((row, index) => (
            <View
              key={rowKey(row)}
              role="listitem"
              testID={rowId(row)}
              style={[styles.card, index > 0 && styles.separated]}
            >
              {columns.map((column, position) => (
                <View key={column.label} style={styles.line}>
                  {position === 0 ? null : (
                    <Text variant="label" tone="muted">
                      {column.label}
                    </Text>
                  )}
                  <Cell strong={position === 0}>{column.render(row)}</Cell>
                </View>
              ))}
            </View>
          ))}
        </View>
      </Panel>
    );
  }

  return (
    <Panel padding="none" testID={testID}>
      <View role="table" accessibilityLabel={label}>
        <View role="row" style={[styles.row, styles.header]}>
          {columns.map((column) => (
            <View key={column.label} role="columnheader" style={{ flex: column.flex }}>
              <Text variant="label" tone="muted">
                {column.label}
              </Text>
            </View>
          ))}
        </View>
        {rows.map((row) => (
          <View
            key={rowKey(row)}
            role="row"
            testID={rowId(row)}
            style={[styles.row, styles.separated]}
          >
            {columns.map((column, position) => (
              <View
                key={column.label}
                role={position === 0 ? 'rowheader' : 'cell'}
                style={{ flex: column.flex }}
              >
                <Cell strong={position === 0}>{column.render(row)}</Cell>
              </View>
            ))}
          </View>
        ))}
      </View>
    </Panel>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.xl, padding: space.lg },
  header: { paddingVertical: space.sm, backgroundColor: colors.sheetSunken },
  separated: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.rule },
  card: { padding: space.lg, gap: space.sm },
  line: { gap: 2 },
});
