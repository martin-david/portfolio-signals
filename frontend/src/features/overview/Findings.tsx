import { StyleSheet, View } from 'react-native';

import type { CopySegment, Finding } from '@/features/portfolio/narrative';
import { Amount, Grid, Heading, Text, colors, space, useBreakpoint } from '@/ui';

function Copy({ segments, currency }: { segments: readonly CopySegment[]; currency: string }) {
  return (
    <Text tone="muted" style={styles.body}>
      {segments.map((segment, index) =>
        typeof segment === 'string' ? (
          segment
        ) : (
          <Amount
            key={index}
            value={segment.amount}
            signed={segment.signed}
            currency={currency}
            tone="muted"
          />
        ),
      )}
    </Text>
  );
}

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
          <Copy segments={finding.body} currency={currency} />
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
