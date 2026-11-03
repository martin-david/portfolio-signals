import { StyleSheet, View } from 'react-native';

import type { AnalyzedHoldingDto } from '@/api/schema';
import { useHolding } from '@/features/portfolio/hooks';
import { signalCells } from '@/features/portfolio/signals';
import { RouteLink, LinkText } from '@/shell/RouteLink';
import { ErrorState, Grid, SkeletonBlock, Text, colors, space, useBreakpoint } from '@/ui';

import { analystFacts } from './detail';
import { FactList } from './FactList';
import { FlagList } from './FlagList';
import { ResultLines } from './ResultLines';

/** The id the row's button points at (aria-controls). */
export function detailId(symbol: string): string {
  return `holding-detail-${symbol.replace(/[^a-zA-Z0-9]/g, '-')}`;
}

export interface RowDetailProps {
  row: AnalyzedHoldingDto;
  /** The signals and the result in words, for the layouts whose row has no room for them. */
  inWords: boolean;
  /** The result against cost lives here when the row has no column for it. */
  showResult: boolean;
  currency: string;
}

/** What opens under a holding: the signals in words when needed, the analysts, the flags, and a way to its own page. */
export function RowDetail({ row, inWords, showResult, currency }: RowDetailProps) {
  const { symbol, name } = row.holding;
  const covered = signalCells(row).some((cell) => cell.present);
  // The analysts' breakdown is only fetched for the holdings the person opens, and only when there is coverage.
  const detail = useHolding(symbol, { enabled: covered });
  const columns = useBreakpoint() === 'compact' ? 1 : 2;
  const signals = detail.data?.signals ?? null;

  return (
    <View
      nativeID={detailId(symbol)}
      testID={`holding-detail-${symbol}`}
      role="region"
      accessibilityLabel={`${symbol} details`}
      style={styles.detail}
    >
      {inWords || showResult ? (
        <ResultLines row={row} currency={currency} withSignals={inWords} withResult={showResult} />
      ) : null}

      <Grid columns={columns} gap={space.xl}>
        <View role="group" accessibilityLabel="Analysts" style={styles.block}>
          <Text variant="smallStrong">
            {row.assessment.viaTicker ? `Analysts (via ${row.assessment.viaTicker})` : 'Analysts'}
          </Text>
          {!covered ? (
            <Text variant="small" tone="muted">
              No analyst signals for this holding.
            </Text>
          ) : detail.isPending ? (
            <SkeletonBlock height={72} />
          ) : detail.isError ? (
            <ErrorState
              error={detail.error}
              title="Couldn't load the analysts"
              onRetry={() => void detail.refetch()}
            />
          ) : (
            <FactList facts={analystFacts(row, signals)} testID={`analysts-${symbol}`} />
          )}
        </View>
        <View role="group" accessibilityLabel="Flags" style={styles.block}>
          <Text variant="smallStrong">Flags</Text>
          {row.assessment.flags.length > 0 ? (
            <FlagList flags={row.assessment.flags} />
          ) : (
            <Text variant="small" tone="muted">
              Nothing to flag.
            </Text>
          )}
        </View>
      </Grid>

      <RouteLink
        href={{ pathname: '/holdings/[symbol]', params: { symbol } }}
        accessibilityLabel={`Everything about ${symbol}, ${name}`}
        testID={`open-${symbol}`}
      >
        <LinkText>{`Everything about ${symbol}`}</LinkText>
      </RouteLink>
    </View>
  );
}

const styles = StyleSheet.create({
  detail: {
    gap: space.lg,
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    paddingBottom: space.md,
    backgroundColor: colors.sheetSunken,
  },
  block: { gap: space.xs },
});
