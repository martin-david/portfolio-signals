import { StyleSheet, View } from 'react-native';

import { Text, colors, space } from '@/ui';

import type { Fact } from './detail';

export interface FactListProps {
  facts: readonly Fact[];
  testID?: string;
}

/** Labels and readings, one per line. Each reads as one item: "Label, reading". */
export function FactList({ facts, testID }: FactListProps) {
  return (
    <View role="list" testID={testID}>
      {facts.map((fact, index) => (
        <View
          key={fact.label}
          role="listitem"
          accessible
          style={[styles.fact, index > 0 && styles.separated]}
        >
          <Text variant="small" tone="muted" style={styles.label}>
            {fact.label}
          </Text>
          <Text variant="small" style={styles.value}>
            {fact.value}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  fact: { flexDirection: 'row', flexWrap: 'wrap', columnGap: space.md, paddingVertical: 6 },
  separated: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.rule2 },
  label: { width: 150 },
  value: { flexGrow: 1, flexShrink: 1, flexBasis: 180 },
});
