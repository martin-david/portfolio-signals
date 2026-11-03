import { Children, isValidElement, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { space } from './tokens';

export interface GridProps {
  columns: number;
  /** Space between the columns, in dp. */
  gap?: number;
  /** Space between the rows; zero unless asked for, since cells usually space themselves through what they hold. */
  rowGap?: number;
  children: ReactNode;
  /** Announce the grid as a list and each cell as one of its items. */
  list?: boolean;
  testID?: string;
}

/**
 * Equal columns that wrap. The container is widened by the gap so that the cells' outer edges line up with the
 * content above and below, the way a CSS grid with a column gap does.
 */
export function Grid({
  columns,
  gap = space.xxl,
  rowGap = 0,
  children,
  list = false,
  testID,
}: GridProps) {
  const cells = Children.toArray(children);
  return (
    <View
      testID={testID}
      role={list ? 'list' : undefined}
      style={[styles.grid, { marginHorizontal: -gap / 2, rowGap }]}
    >
      {cells.map((cell, index) => (
        <View
          key={isValidElement(cell) && cell.key !== null ? cell.key : index}
          role={list ? 'listitem' : undefined}
          style={{ width: `${100 / columns}%`, paddingHorizontal: gap / 2 }}
        >
          {cell}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
});
