import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import type { AnalyzedHoldingDto, HoldingDetailDto } from '@/api/schema';
import { ProviderNotices } from '@/features/integrations/DataFreshness';
import { VerdictChip } from '@/features/portfolio/components/VerdictChip';
import { useHolding, usePortfolio } from '@/features/portfolio/hooks';
import { describeSignalsFetched } from '@/features/portfolio/narrative';
import { noSignalsReason, signalCells } from '@/features/portfolio/signals';
import { tierLabel } from '@/features/portfolio/verdicts';
import { formatNumber, formatPercent, formatSignedPercent } from '@/lib/format';
import { useNow } from '@/lib/useNow';
import { PageTitle } from '@/shell/PageTitle';
import { LinkText, RouteLink } from '@/shell/RouteLink';
import {
  Amount,
  Band,
  EmptyState,
  ErrorState,
  Grid,
  Heading,
  Icon,
  LoadingRegion,
  Screen,
  SkeletonBlock,
  Text,
  colors,
  space,
  useBreakpoint,
} from '@/ui';

import {
  aiFacts,
  analystFacts,
  cannotSee,
  earningsFact,
  momentumFacts,
  technicalFacts,
  type Fact,
} from './detail';
import { FactList } from './FactList';
import { FlagList } from './FlagList';
import { SignalRow } from './SignalCells';

function BackLink() {
  return (
    <RouteLink href="/holdings" accessibilityLabel="Back to all holdings">
      <View style={styles.back}>
        <Icon name="arrow-left" size={20} color={colors.blue} />
        <LinkText>All holdings</LinkText>
      </View>
    </RouteLink>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View role="group" accessibilityLabel={title} style={styles.section}>
      <Heading level={2} variant="heading">
        {title}
      </Heading>
      {children}
    </View>
  );
}

function Absent({ children }: { children: string }) {
  return (
    <Text variant="small" tone="muted">
      {children}
    </Text>
  );
}

function Facts({ facts, empty, testID }: { facts: Fact[]; empty: string; testID: string }) {
  return facts.length > 0 ? <FactList facts={facts} testID={testID} /> : <Absent>{empty}</Absent>;
}

/** What the person holds: value, cost, result, weight and size of the position. Their own amounts can be hidden. */
function Position({ row, currency }: { row: AnalyzedHoldingDto; currency: string }) {
  const { holding, assessment } = row;
  const lines: { label: string; value: ReactNode }[] = [
    {
      label: 'Value',
      value: <Amount value={holding.value} currency={currency} variant="small" />,
    },
    {
      label: 'Paid',
      value: <Amount value={holding.invested} currency={currency} variant="small" />,
    },
    {
      label: 'Result',
      value: (
        <Text variant="small">
          {`${formatSignedPercent(holding.pnlPct)} (`}
          <Amount value={holding.pnl} currency={currency} signed variant="small" />
          {')'}
        </Text>
      ),
    },
    {
      label: 'Weight',
      value: <Text variant="small">{`${formatPercent(assessment.weightPct)} of the account`}</Text>,
    },
    { label: 'Units', value: <Text variant="small">{formatNumber(holding.units, 4)}</Text> },
    {
      label: 'Average open rate',
      value: <Text variant="small">{formatNumber(holding.avgOpenRate, 2)}</Text>,
    },
  ];
  if (holding.avgLeverage !== 1) {
    lines.push({
      label: 'Leverage',
      value: <Text variant="small">{`${formatNumber(holding.avgLeverage, 1)}\u00d7`}</Text>,
    });
  }
  return (
    <View role="list" testID="position">
      {lines.map((line, index) => (
        <View key={line.label} role="listitem" style={[styles.line, index > 0 && styles.separated]}>
          <Text variant="small" tone="muted" style={styles.lineLabel}>
            {line.label}
          </Text>
          <View style={styles.lineValue}>{line.value}</View>
        </View>
      ))}
    </View>
  );
}

function Loaded({
  detail,
  currency,
  now,
}: {
  detail: HoldingDetailDto;
  currency: string;
  now: Date;
}) {
  const wide = useBreakpoint() === 'wide';
  const row = detail.analysis;
  const { holding, assessment } = row;
  const signals = detail.signals;
  const cells = signalCells(row);
  const covered = cells.some((cell) => cell.present);
  const earnings = earningsFact(assessment.facts);
  const ai = aiFacts(row, signals);
  const technicals = technicalFacts(signals);
  const momentum = momentumFacts(signals, assessment.facts);
  const subtitle = [holding.name, signals?.sector, holding.assetClass]
    .filter(Boolean)
    .join(' \u00b7 ');

  return (
    <>
      <Band first>
        <View style={styles.header}>
          <BackLink />
          <View style={styles.title}>
            <Heading level={1}>{holding.symbol}</Heading>
            <VerdictChip verdict={assessment.verdict} testID="holding-verdict" />
          </View>
          <Text tone="muted">{subtitle}</Text>
          <Text variant="smallStrong" testID="holding-score">
            {assessment.composite === null
              ? `No score (${tierLabel(assessment.tier)})`
              : `Score ${assessment.composite}, ${tierLabel(assessment.tier)}`}
          </Text>
          <Text variant="caption" tone="subtle">
            {describeSignalsFetched(detail.signalsFetchedAt, now)}
          </Text>
          <ProviderNotices />
        </View>
      </Band>

      <Band tone="sheet">
        <Grid columns={wide ? 2 : 1} gap={space.huge}>
          <Section title="Your position">
            <Position row={row} currency={currency} />
          </Section>
          <Section title="Flags">
            {assessment.flags.length > 0 ? (
              <FlagList flags={assessment.flags} />
            ) : (
              <Absent>Nothing to flag.</Absent>
            )}
          </Section>
        </Grid>
      </Band>

      <Band>
        <View style={styles.block}>
          <Heading level={2} variant="heading">
            The six signals
          </Heading>
          {covered ? (
            <>
              <Text tone="muted" style={styles.lede}>
                Where each signal sits on its scale. The shaded stretch is the supportive zone; the
                marker turns teal inside a clearly good reading and crimson when it is clearly
                adverse.
              </Text>
              <View role="list" testID="signals">
                {cells.map((cell) => (
                  <SignalRow key={cell.key} cell={cell} />
                ))}
              </View>
            </>
          ) : (
            <Absent>
              {noSignalsReason(row) ?? 'There are no analyst signals for this holding.'}
            </Absent>
          )}
        </View>
      </Band>

      {covered ? (
        <Band tone="sheet">
          <Grid columns={wide ? 2 : 1} gap={space.huge}>
            <Section title="Analysts">
              <FactList facts={analystFacts(row, signals)} testID="analysts" />
            </Section>
            <Section title="AI analysis">
              <Facts facts={ai} empty="TipRanks has no AI analysis for this holding." testID="ai" />
            </Section>
            <Section title="Technicals">
              <Facts
                facts={technicals}
                empty="No technical analysis was reported."
                testID="technicals"
              />
            </Section>
            <Section title="Price and momentum">
              <Facts
                facts={momentum}
                empty="No price or momentum figures were reported."
                testID="momentum"
              />
            </Section>
            <Section title="Earnings">
              <Facts
                facts={earnings ? [earnings] : []}
                empty="No earnings date is known."
                testID="earnings"
              />
            </Section>
          </Grid>
        </Band>
      ) : null}

      <Band tone={covered ? 'paper' : 'sheet'}>
        <View style={styles.block}>
          <Heading level={2} variant="heading">
            What the data cannot see
          </Heading>
          <View role="list" testID="cannot-see">
            {cannotSee(row).map((line) => (
              <View key={line} role="listitem" style={styles.cannot}>
                <Text>{line}</Text>
              </View>
            ))}
          </View>
          <Text variant="small" tone="subtle" style={styles.lede}>
            Not available yet: the bull and bear case, the latest catalyst and company fundamentals.
            Informational only, not investment advice.
          </Text>
          <RouteLink href="/method">
            <LinkText>How verdicts are decided</LinkText>
          </RouteLink>
        </View>
      </Band>
    </>
  );
}

/** One holding on its own page: what the rules found, the six signals behind them, and what lies beyond the data. */
export function HoldingScreen({ symbol }: { symbol: string }) {
  const now = useNow();
  const holding = useHolding(symbol);
  const portfolio = usePortfolio();
  const currency = portfolio.data?.account.currency ?? 'USD';

  return (
    <Screen>
      <PageTitle title={symbol} />
      {holding.isPending ? (
        <Band first>
          <LoadingRegion label={`Loading ${symbol}`}>
            <SkeletonBlock height={44} width="40%" />
            <SkeletonBlock height={20} width="30%" />
            <SkeletonBlock height={160} />
          </LoadingRegion>
        </Band>
      ) : holding.isError ? (
        <Band first>
          <View style={styles.header}>
            <BackLink />
            <ErrorState
              error={holding.error}
              title={`Couldn't load ${symbol}`}
              onRetry={() => void holding.refetch()}
            />
          </View>
        </Band>
      ) : holding.data === null ? (
        <Band first>
          <View style={styles.header}>
            <BackLink />
            <EmptyState title={`${symbol} is not in your latest snapshot`}>
              It may have been sold since, or the symbol may be mistyped. The holdings list shows
              what the latest snapshot holds.
            </EmptyState>
          </View>
        </Band>
      ) : (
        <Loaded detail={holding.data} currency={currency} now={now} />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: space.sm },
  back: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  title: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: space.lg,
    rowGap: space.xs,
  },
  block: { gap: space.md },
  lede: { maxWidth: 720 },
  section: { gap: space.sm, paddingBottom: space.lg },
  line: { flexDirection: 'row', flexWrap: 'wrap', columnGap: space.md, paddingVertical: 6 },
  separated: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.rule2 },
  lineLabel: { width: 150 },
  lineValue: { flexGrow: 1, flexShrink: 1, flexBasis: 160 },
  cannot: { paddingVertical: space.xs, maxWidth: 720 },
});
