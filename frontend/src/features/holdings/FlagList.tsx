import { StyleSheet, View } from 'react-native';

import type { AssessmentFlag } from '@/api/schema';
import { SeverityLabel } from '@/features/portfolio/components/SeverityLabel';
import { severityMeta } from '@/features/portfolio/verdicts';
import { Text, space } from '@/ui';

export interface FlagListProps {
  flags: readonly AssessmentFlag[];
}

/** What the rules noticed about the holding, most serious first, each with a glyph and a word for its severity. */
export function FlagList({ flags }: FlagListProps) {
  const sorted = [...flags].sort(
    (a, b) => severityMeta[a.severity].rank - severityMeta[b.severity].rank,
  );
  return (
    <View role="list" testID="flags">
      {sorted.map((flag) => (
        <View key={flag.key} role="listitem" style={styles.flag}>
          <View style={styles.severity}>
            <SeverityLabel severity={flag.severity} />
          </View>
          <View style={styles.text}>
            <Text variant="smallStrong">{flag.title}</Text>
            <Text variant="small" tone="muted">
              {flag.detail}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  flag: { flexDirection: 'row', flexWrap: 'wrap', columnGap: space.md, paddingVertical: 6 },
  severity: { width: 96 },
  text: { flexGrow: 1, flexShrink: 1, flexBasis: 200, gap: 2 },
});
