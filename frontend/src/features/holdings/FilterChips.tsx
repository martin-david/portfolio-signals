import { Pressable, StyleSheet, View } from 'react-native';

import type { PanelFilter } from '@/features/portfolio/panel';
import { Text, colors, isHovered, radius, space, webAria } from '@/ui';

const OPTIONS: { key: PanelFilter; label: (count: number) => string }[] = [
  { key: 'all', label: (count) => `All ${count}` },
  { key: 'material', label: (count) => `Above 1% (${count})` },
  { key: 'attention', label: (count) => `Watch or review (${count})` },
];

export interface FilterChipsProps {
  filter: PanelFilter;
  counts: Record<PanelFilter, number>;
  onChange: (filter: PanelFilter) => void;
}

/** Which holdings to show. Each chip is a toggle: pressed means it is the filter in use. */
export function FilterChips({ filter, counts, onChange }: FilterChipsProps) {
  return (
    <View role="group" accessibilityLabel="Filter holdings" style={styles.row} testID="filters">
      {OPTIONS.map((option) => {
        const active = filter === option.key;
        return (
          <Pressable
            key={option.key}
            role="button"
            onPress={() => onChange(option.key)}
            accessibilityLabel={option.label(counts[option.key])}
            accessibilityState={{ selected: active }}
            testID={`filter-${option.key}`}
            style={(state) => [
              styles.chip,
              active && styles.active,
              !active && isHovered(state) && styles.hovered,
            ]}
            {...webAria({ 'aria-pressed': active })}
          >
            <Text variant="smallStrong" tone={active ? 'inverse' : 'ink'}>
              {option.label(counts[option.key])}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: space.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.controlBorder,
    backgroundColor: colors.sheet,
  },
  active: { backgroundColor: colors.ink, borderColor: colors.ink },
  hovered: { backgroundColor: colors.slateBg },
});
