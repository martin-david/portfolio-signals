import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';

import { DataFreshness } from '@/features/integrations/DataFreshness';
import { useAnalysis, usePortfolio } from '@/features/portfolio/hooks';
import {
  DEFAULT_SORT,
  describeSort,
  filterCounts,
  filterHoldings,
  nextSort,
  sortHoldings,
  type PanelFilter,
  type PanelSort,
  type SortKey,
} from '@/features/portfolio/panel';
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

import { FilterChips } from './FilterChips';
import { HoldingsPanel } from './HoldingsPanel';
import { panelMode, showsPnlColumn } from './panelLayout';

/** Every holding with its verdict, score, signals and result against cost, sortable and filterable. */
export function HoldingsScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const analysis = useAnalysis();
  const portfolio = usePortfolio();
  const [filter, setFilter] = useState<PanelFilter>('all');
  const [sort, setSort] = useState<PanelSort>(DEFAULT_SORT);
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set());
  const [pulling, setPulling] = useState(false);

  const mode = panelMode(width);
  const currency = portfolio.data?.account.currency ?? 'USD';

  async function refresh() {
    setPulling(true);
    await Promise.allSettled([analysis.refetch(), portfolio.refetch()]);
    setPulling(false);
  }

  function toggle(symbol: string) {
    setExpanded((open) => {
      const next = new Set(open);
      if (!next.delete(symbol)) {
        next.add(symbol);
      }
      return next;
    });
  }

  function content() {
    if (analysis.isPending) {
      return (
        <LoadingRegion label="Loading your holdings">
          <SkeletonBlock height={44} width="60%" />
          <SkeletonBlock height={64} />
          <SkeletonBlock height={64} />
          <SkeletonBlock height={64} />
        </LoadingRegion>
      );
    }
    if (analysis.isError) {
      return (
        <ErrorState
          error={analysis.error}
          title="Couldn't load your holdings"
          onRetry={() => void analysis.refetch()}
        />
      );
    }
    if (analysis.data === null) {
      return (
        <EmptyState
          title="No holdings yet"
          action={{ label: 'Go to Connections', onPress: () => router.push('/connections') }}
        >
          Connect eToro and run the first sync to see every holding scored.
        </EmptyState>
      );
    }

    const rows = analysis.data.holdings;
    if (rows.length === 0) {
      return (
        <EmptyState title="No holdings in the latest snapshot">
          The latest eToro snapshot holds none of your own positions. Copy trading and cash are not
          assessed.
        </EmptyState>
      );
    }
    const visible = sortHoldings(filterHoldings(rows, filter), sort);
    const weightMax = Math.max(...rows.map((row) => row.assessment.weightPct));

    return (
      <View style={styles.content}>
        <FilterChips filter={filter} counts={filterCounts(rows)} onChange={setFilter} />
        <Text variant="small" tone="muted" accessibilityLiveRegion="polite" testID="panel-caption">
          {`Showing ${visible.length} of ${rows.length}. Sorted by ${describeSort(sort).toLowerCase()}.`}
        </Text>
        {visible.length === 0 ? (
          <EmptyState
            title="No holdings match this filter"
            action={{ label: 'Show all holdings', onPress: () => setFilter('all') }}
          />
        ) : (
          <HoldingsPanel
            rows={visible}
            weightMax={weightMax}
            sort={sort}
            onSort={(key: SortKey) => setSort((current) => nextSort(current, key))}
            expanded={expanded}
            onToggle={toggle}
            mode={mode}
            showPnl={showsPnlColumn(width)}
            currency={currency}
          />
        )}
        <Text variant="caption" tone="subtle" style={styles.note}>
          Score is the average of the six signals, from −100 to +100. Review means look again, not
          sell.
        </Text>
      </View>
    );
  }

  return (
    <Screen refreshing={pulling} onRefresh={() => void refresh()}>
      <PageTitle title="Holdings" />
      <Band first>
        <View style={styles.intro}>
          <Heading level={1}>Holdings</Heading>
          <Text tone="muted" style={styles.lede}>
            {mode === 'table'
              ? 'Each bar shows where a signal sits on its scale. The shaded stretch is the supportive zone, and the marker turns teal inside it and crimson when it is clearly adverse. Select a holding to see its flags and analysts.'
              : 'Select a holding to see its signals, flags and analysts.'}
          </Text>
          {analysis.data ? <DataFreshness analysis={analysis.data} /> : null}
        </View>
      </Band>
      <Band tone="sheet">{content()}</Band>
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: { gap: space.sm },
  lede: { maxWidth: 720 },
  content: { gap: space.md },
  note: { maxWidth: 720 },
});
