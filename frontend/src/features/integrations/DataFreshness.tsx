import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import type { PortfolioAnalysisDto } from '@/api/schema';
import { describeSnapshot } from '@/features/portfolio/narrative';
import { useNow } from '@/lib/useNow';
import { Text, space, useBreakpoint } from '@/ui';

import { freshnessNotices } from './freshness';
import { FreshnessNotices } from './FreshnessNotices';
import { useIntegrations } from './hooks';

/**
 * What is wrong with a provider that makes the data older than it should be: rejected credentials, rate limits, a
 * failed or late sync, a provider that is not connected. A screen that shows the data owes the person this as much as
 * the Overview does. Nothing is shown while the connections are loading or when they cannot be read.
 */
export function ProviderNotices() {
  const router = useRouter();
  const now = useNow();
  const integrations = useIntegrations();
  const notices = integrations.data ? freshnessNotices(integrations.data, now) : [];
  return <FreshnessNotices notices={notices} onAction={() => router.push('/connections')} />;
}

export interface DataFreshnessProps {
  analysis: Pick<PortfolioAnalysisDto, 'asOf' | 'signalsFetchedAt'>;
}

/** Where the numbers on a screen come from and how old they are, then anything that is keeping them from being newer. */
export function DataFreshness({ analysis }: DataFreshnessProps) {
  const compact = useBreakpoint() === 'compact';
  const meta = describeSnapshot(analysis, useNow());
  return (
    <View style={styles.block} testID="data-freshness">
      <View style={[styles.meta, compact && styles.metaCompact]}>
        <Text variant="small" tone="subtle">
          {meta.snapshot}
        </Text>
        <Text variant="small" tone="subtle">
          {meta.signals}
        </Text>
      </View>
      <ProviderNotices />
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: space.md },
  meta: { flexDirection: 'row', flexWrap: 'wrap', columnGap: space.xl, rowGap: space.xs },
  metaCompact: { flexDirection: 'column' },
});
