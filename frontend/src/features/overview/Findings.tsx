import { StyleSheet, View } from 'react-native';

import { CopyText } from '@/features/portfolio/components/CopyText';
import type { Finding } from '@/features/portfolio/narrative';
import { Grid, Heading, colors, space, useBreakpoint } from '@/ui';

export interface FindingsProps {
  findings: readonly Finding[];
  currency?: string;
}

/** What stands out, in four short paragraphs: quality, concentration, timing and housekeeping. */
export function Findings({ findings, currency = 'USD' }: FindingsProps) {
  const wide = useBreakpoint() === 'wide';
  return (
    <Grid list columns={wide ? 2 : 1} gap={space.huge} testID="findings">
      {findings.map((finding) => (
        <View key={finding.key} testID={`finding-${finding.key}`} style={styles.finding}>
          <Heading level={3} variant="subheading">
            {finding.title}
          </Heading>
          <CopyText segments={finding.body} currency={currency} style={styles.body} />
        </View>
      ))}
    </Grid>
  );
}

const styles = StyleSheet.create({
  finding: {
    gap: space.xs,
    paddingVertical: 18,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.rule,
  },
  body: { maxWidth: 560 },
});
