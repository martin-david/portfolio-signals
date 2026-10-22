import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useAnalysis } from '@/features/portfolio/hooks';
import {
  EARNINGS_WINDOW_DAYS,
  describeGaps,
  earningsByDay,
  earningsHeading,
  earningsSummary,
  targetGaps,
  targetRows,
} from '@/features/portfolio/charts';
import { PageTitle } from '@/shell/PageTitle';
import {
  Band,
  EmptyState,
  ErrorState,
  Heading,
  LoadingRegion,
  Screen,
  SkeletonBlock,
  Text,
  space,
} from '@/ui';

import { EarningsChart } from './EarningsChart';
import { TargetsChart, TargetsKey } from './TargetsChart';

/** Two questions the verdicts do not answer alone: do analysts and AI models agree, and when do the holdings report? */
export function InsightsScreen() {
  const router = useRouter();
  const analysis = useAnalysis();
  const [pulling, setPulling] = useState(false);

  async function refresh() {
    setPulling(true);
    await analysis.refetch();
    setPulling(false);
  }

  function body() {
    if (analysis.isPending) {
      return (
        <Band>
          <LoadingRegion label="Loading your insights">
            <SkeletonBlock height={28} width="50%" />
            <SkeletonBlock height={220} />
          </LoadingRegion>
        </Band>
      );
    }
    if (analysis.isError) {
      return (
        <Band>
          <ErrorState
            error={analysis.error}
            title="Couldn't load your insights"
            onRetry={() => void analysis.refetch()}
          />
        </Band>
      );
    }
    if (analysis.data === null) {
      return (
        <Band>
          <EmptyState
            title="No insights yet"
            action={{ label: 'Go to Connections', onPress: () => router.push('/connections') }}
          >
            Connect eToro and TipRanks and run the first sync. The charts are drawn from the latest
            analysis.
          </EmptyState>
        </Band>
      );
    }

    const targets = targetRows(analysis.data);
    const days = earningsByDay(analysis.data);

    return (
      <>
        <Band tone="sheet">
          <View style={styles.section}>
            <Heading level={2}>Where Wall Street and the AI models disagree</Heading>
            <Text tone="muted" style={styles.lede}>
              Two views of the same question: what is each stock worth in a year? The AI figure
              comes from TipRanks&apos; own language-model analysis; the Street figure is the
              average of human analyst targets. Where they split, treat the upside as less certain.
            </Text>
            {targets.length > 0 ? (
              <>
                <TargetsKey />
                <TargetsChart rows={targets} />
                <Text variant="small" tone="muted" style={styles.lede} testID="targets-caption">
                  {describeGaps(targetGaps(targets))}
                </Text>
                <Text variant="caption" tone="subtle" style={styles.lede}>
                  Only holdings with enough analyst targets to trust are shown.
                </Text>
              </>
            ) : (
              <EmptyState title="Nothing to compare">
                No holding has enough analyst targets to trust yet.
              </EmptyState>
            )}
          </View>
        </Band>

        <Band>
          <View style={styles.section}>
            <Heading level={2}>{earningsHeading(days)}</Heading>
            {days.length > 0 ? (
              <>
                <Text tone="muted" style={styles.lede} testID="earnings-summary">
                  {earningsSummary(days)}
                </Text>
                <EarningsChart days={days} />
                <Text variant="caption" tone="subtle" style={styles.lede}>
                  {`Bars are sized by each holding's share of your account. Funds, crypto and reports more than ${EARNINGS_WINDOW_DAYS} days away are not shown.`}
                </Text>
              </>
            ) : (
              <EmptyState title="No earnings reports soon">
                {`None of your stocks reports earnings within ${EARNINGS_WINDOW_DAYS} days.`}
              </EmptyState>
            )}
          </View>
        </Band>
      </>
    );
  }

  return (
    <Screen refreshing={pulling} onRefresh={() => void refresh()}>
      <PageTitle title="Insights" />
      <Band first>
        <View style={styles.section}>
          <Heading level={1}>Insights</Heading>
          <Text tone="muted" style={styles.lede}>
            What the verdicts cannot show on their own: how far analysts and AI models agree, and
            when your holdings are tested.
          </Text>
        </View>
      </Band>
      {body()}
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.lg },
  lede: { maxWidth: 720 },
});
