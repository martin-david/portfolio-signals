import { StyleSheet, View } from 'react-native';

import type { AssessmentFlag, FlagSeverity } from '@/api/schema';
import { severityLabel } from '@/features/portfolio/verdicts';
import { StatusLabel, Text, space, type StatusTone } from '@/ui';

const severity: Record<FlagSeverity, { tone: StatusTone; icon: string; rank: number }> = {
  Alert: { tone: 'danger', icon: 'alert-circle-outline', rank: 0 },
  Warn: { tone: 'warning', icon: 'alert-outline', rank: 1 },
  Info: { tone: 'neutral', icon: 'information-outline', rank: 2 },
};

export interface FlagListProps {
  flags: readonly AssessmentFlag[];
}

/** What the rules noticed about the holding, most serious first, each with a glyph and a word for its severity. */
export function FlagList({ flags }: FlagListProps) {
  const sorted = [...flags].sort((a, b) => severity[a.severity].rank - severity[b.severity].rank);
  return (
    <View role="list" testID="flags">
      {sorted.map((flag) => {
        const style = severity[flag.severity];
        return (
          <View key={flag.key} role="listitem" style={styles.flag}>
            <View style={styles.severity}>
              <StatusLabel tone={style.tone} icon={style.icon}>
                {severityLabel(flag.severity)}
              </StatusLabel>
            </View>
            <View style={styles.text}>
              <Text variant="smallStrong">{flag.title}</Text>
              <Text variant="small" tone="muted">
                {flag.detail}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  flag: { flexDirection: 'row', flexWrap: 'wrap', columnGap: space.md, paddingVertical: 6 },
  severity: { width: 96 },
  text: { flexGrow: 1, flexShrink: 1, flexBasis: 200, gap: 2 },
});
