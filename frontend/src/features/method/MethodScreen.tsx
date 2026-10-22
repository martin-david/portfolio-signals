import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import type { FlagSeverity } from '@/api/schema';
import { SeverityLabel } from '@/features/portfolio/components/SeverityLabel';
import { VerdictChip } from '@/features/portfolio/components/VerdictChip';
import { tierLabel } from '@/features/portfolio/verdicts';
import { PageTitle } from '@/shell/PageTitle';
import { LinkText, RouteLink } from '@/shell/RouteLink';
import { Band, Grid, Heading, Screen, Text, space, useBreakpoint } from '@/ui';

import {
  DISCLAIMER,
  FLAG_RULES,
  MATERIAL_NOTE,
  REVIEW_NOTE,
  SCORE_RULE,
  SIGNALS_NOT_YET,
  SIGNAL_RULES,
  SOURCES,
  TIER_RULES,
  WARNING_NOTE,
  WEIGHTS_NOTE,
  WHAT_IS_MISSING,
  type FlagRule,
  type SignalRule,
  type TierRule,
  type VerdictOutcome,
} from './content';
import { ReferenceTable } from './ReferenceTable';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View role="group" accessibilityLabel={title} style={styles.section}>
      <Heading level={2}>{title}</Heading>
      {children}
    </View>
  );
}

function Outcomes({ outcomes }: { outcomes: readonly VerdictOutcome[] }) {
  return (
    <View style={styles.outcomes}>
      {outcomes.map((outcome) => (
        <View key={outcome.verdict} style={styles.outcome}>
          <View style={styles.chipSlot}>
            <VerdictChip verdict={outcome.verdict} />
          </View>
          {outcome.when ? (
            <Text variant="small" style={styles.when}>
              {outcome.when}
            </Text>
          ) : null}
        </View>
      ))}
    </View>
  );
}

function Severities({ severities }: { severities: readonly FlagSeverity[] }) {
  return (
    <View style={styles.severities}>
      {severities.map((severity) => (
        <SeverityLabel key={severity} severity={severity} />
      ))}
    </View>
  );
}

const signalColumns = [
  { label: 'Signal', flex: 1, render: (rule: SignalRule) => rule.name },
  { label: 'Source', flex: 1.4, render: (rule: SignalRule) => rule.source },
  { label: 'Scaled to \u22121 \u2026 +1', flex: 1.8, render: (rule: SignalRule) => rule.scale },
];

const tierColumns = [
  { label: 'Tier', flex: 0.8, render: (rule: TierRule) => tierLabel(rule.tier) },
  { label: 'Score', flex: 0.8, render: (rule: TierRule) => rule.range },
  { label: 'Verdict', flex: 3, render: (rule: TierRule) => <Outcomes outcomes={rule.outcomes} /> },
];

const flagColumns = [
  { label: 'Flag', flex: 1.3, render: (rule: FlagRule) => rule.title },
  { label: 'When it appears', flex: 2.4, render: (rule: FlagRule) => rule.rule },
  {
    label: 'Severity',
    flex: 0.9,
    render: (rule: FlagRule) => <Severities severities={rule.severities} />,
  },
];

/** How a verdict is reached, written out so that nothing about it has to be taken on trust. */
export function MethodScreen() {
  const wide = useBreakpoint() !== 'compact';

  return (
    <Screen>
      <PageTitle title="Method" />
      <Band first>
        <View style={styles.section}>
          <Heading level={1}>Method</Heading>
          <Text tone="muted" style={styles.lede}>
            How a verdict is reached, and what it cannot tell you. The rules are fixed: the same
            data always gives the same verdict.
          </Text>
          <RouteLink href="/holdings">
            <LinkText>See the verdicts on your holdings</LinkText>
          </RouteLink>
        </View>
      </Band>

      <Band tone="sheet">
        <Section title="Six signals, equal weight">
          <ReferenceTable
            label="The six signals of the score"
            columns={signalColumns}
            rows={SIGNAL_RULES}
            rowKey={(rule) => rule.name}
            testID="signals"
          />
          <Text style={styles.lede} testID="score-rule">
            {SCORE_RULE}
          </Text>
          <Text tone="muted" style={styles.lede}>
            {SIGNALS_NOT_YET}
          </Text>
          <Text tone="muted" style={styles.lede}>
            {WEIGHTS_NOTE}
          </Text>
        </Section>
      </Band>

      <Band>
        <Section title="From score to verdict">
          <ReferenceTable
            label="How a score becomes a verdict"
            columns={tierColumns}
            rows={TIER_RULES}
            rowKey={(rule) => rule.tier}
            testID="tiers"
          />
          <Text variant="bodyStrong" style={styles.lede} testID="review-note">
            {REVIEW_NOTE}
          </Text>
          <Text tone="muted" style={styles.lede}>
            {MATERIAL_NOTE}
          </Text>
        </Section>
      </Band>

      <Band tone="sheet">
        <Section title="What the rules look for">
          <ReferenceTable
            label="The flags the rules raise"
            columns={flagColumns}
            rows={FLAG_RULES}
            rowKey={(rule) => rule.key}
            testID="flags-reference"
          />
          <Text tone="muted" style={styles.lede}>
            {WARNING_NOTE}
          </Text>
        </Section>
      </Band>

      <Band>
        <Grid columns={wide ? 2 : 1} rowGap={space.xl}>
          <Section title="What is missing">
            <View role="list" style={styles.list}>
              {WHAT_IS_MISSING.map((item) => (
                <View key={item} role="listitem" style={styles.item}>
                  <Text aria-hidden>{'\u2022'}</Text>
                  <Text style={styles.itemText}>{item}</Text>
                </View>
              ))}
            </View>
          </Section>
          <Section title="Sources and limits">
            <Text>{SOURCES}</Text>
          </Section>
        </Grid>
      </Band>

      <Band tone="sheet" padding="tight">
        <Text variant="small" tone="subtle" style={styles.lede} testID="disclaimer">
          {DISCLAIMER}
        </Text>
      </Band>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.lg },
  lede: { maxWidth: 720 },
  outcomes: { gap: space.sm },
  outcome: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    columnGap: space.md,
    rowGap: space.xs,
  },
  chipSlot: { width: 112 },
  when: { flexGrow: 1, flexShrink: 1, flexBasis: 180, paddingTop: 2 },
  severities: { gap: space.xs },
  list: { gap: space.sm },
  item: { flexDirection: 'row', gap: space.sm },
  itemText: { flexShrink: 1 },
});
