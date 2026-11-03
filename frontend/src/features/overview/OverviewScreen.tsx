import { useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { describeError, isApiError } from '@/api/errors';
import type { IntegrationDto, PortfolioAnalysisDto, PortfolioDto } from '@/api/schema';
import { FreshnessNotices } from '@/features/integrations/FreshnessNotices';
import { freshnessNotices } from '@/features/integrations/freshness';
import { useIntegrations } from '@/features/integrations/hooks';
import { useAnalysis, usePortfolio } from '@/features/portfolio/hooks';
import {
  attentionItems,
  buildFindings,
  buildHeadline,
  describeSnapshot,
} from '@/features/portfolio/narrative';
import { buildStripSegments } from '@/features/portfolio/strip';
import { useMe } from '@/features/profile/hooks';
import { useRequestSync, useSyncRuns } from '@/features/sync/hooks';
import { useNow } from '@/lib/useNow';
import { PageTitle } from '@/shell/PageTitle';
import { LinkText, RouteLink } from '@/shell/RouteLink';
import {
  Amount,
  Band,
  EmptyState,
  ErrorState,
  Heading,
  LoadingRegion,
  Notice,
  Screen,
  SkeletonBlock,
  Text,
  space,
  useBreakpoint,
  useToast,
} from '@/ui';

import { AttentionList } from './AttentionList';
import { buildChecklist, type ChecklistStep } from './checklist';
import { Findings } from './Findings';
import { GetStarted } from './GetStarted';
import { VerdictStrip } from './VerdictStrip';

function OverviewSkeleton() {
  return (
    <Band first>
      <LoadingRegion label="Loading your overview">
        <SkeletonBlock height={44} width="72%" />
        <SkeletonBlock height={20} width="52%" />
        <SkeletonBlock height={16} width="38%" />
        <SkeletonBlock height={60} style={styles.skeletonStrip} />
        <SkeletonBlock height={72} />
      </LoadingRegion>
    </Band>
  );
}

function Intro({
  headline,
  lede,
  children,
}: {
  headline: string;
  lede: string;
  children?: ReactNode;
}) {
  return (
    <View style={styles.intro}>
      <Heading level={1} style={styles.headline}>
        {headline}
      </Heading>
      <Text tone="muted" style={styles.lede}>
        {lede}
      </Text>
      {children}
    </View>
  );
}

interface SyncedProps {
  analysis: PortfolioAnalysisDto;
  portfolio: { pending: boolean; account: PortfolioDto['account'] | undefined };
  integrations: readonly IntegrationDto[] | undefined;
  now: Date;
  onOpenConnections: () => void;
}

function SyncedOverview({
  analysis,
  portfolio,
  integrations,
  now,
  onOpenConnections,
}: SyncedProps) {
  const compact = useBreakpoint() === 'compact';
  const currency = portfolio.account?.currency ?? 'USD';
  const { headline, lede } = buildHeadline(analysis);
  const meta = describeSnapshot(analysis, now);
  const notices = integrations ? freshnessNotices(integrations, now) : [];
  const attention = attentionItems(analysis);
  const { kpis } = analysis;

  return (
    <>
      <Band first>
        <Intro headline={headline} lede={lede}>
          <View style={[styles.meta, compact && styles.metaCompact]}>
            <Text variant="small" tone="subtle">
              {meta.snapshot}
            </Text>
            <Text variant="small" tone="subtle">
              {meta.signals}
            </Text>
            <Text variant="small" tone="subtle">
              <Amount value={kpis.totalValue} currency={currency} variant="small" tone="subtle" />
              {' in total, '}
              <Amount
                value={kpis.unrealizedPnl}
                currency={currency}
                signed
                variant="small"
                tone="subtle"
              />
              {' unrealised'}
            </Text>
          </View>
        </Intro>

        {notices.length > 0 ? (
          <View style={styles.block}>
            <FreshnessNotices notices={notices} onAction={onOpenConnections} />
          </View>
        ) : null}

        <View style={styles.block}>
          {portfolio.pending ? (
            <LoadingRegion label="Loading the account split">
              <SkeletonBlock height={60} />
              <SkeletonBlock height={56} />
            </LoadingRegion>
          ) : (
            <VerdictStrip
              segments={buildStripSegments(analysis, portfolio.account)}
              currency={currency}
            />
          )}
        </View>
      </Band>

      <Band tone="sheet">
        <View style={styles.section}>
          <Heading level={2}>What stands out</Heading>
          <Findings findings={buildFindings(analysis)} currency={currency} />
        </View>
      </Band>

      <Band>
        <View style={styles.section}>
          <Heading level={2}>Needs a look</Heading>
          <Text tone="muted" style={styles.sectionLede}>
            Positions above 1% of your account that are on watch, to review, or large enough to
            review for size. Review means look again, not sell.
          </Text>
          {attention.length > 0 ? (
            <AttentionList items={attention} />
          ) : (
            <EmptyState title="Nothing needs a look">
              No position above 1% of your account is on watch or review, and none is large enough
              to review for size.
            </EmptyState>
          )}
          <RouteLink href="/holdings">
            <LinkText>{`See all ${analysis.holdings.length} holdings`}</LinkText>
          </RouteLink>
        </View>
      </Band>

      <Band tone="sheet" padding="tight">
        <View style={styles.footer}>
          <Text variant="small" tone="subtle" style={styles.disclaimer}>
            {analysis.disclaimer}
          </Text>
          <RouteLink href="/method">
            <LinkText>How verdicts are decided</LinkText>
          </RouteLink>
        </View>
      </Band>
    </>
  );
}

interface NotSyncedProps {
  integrations: ReturnType<typeof useIntegrations>;
  checklist: ReturnType<typeof buildChecklist> | null;
  now: Date;
  onStep: (step: ChecklistStep) => void;
  syncing: boolean;
  syncError: unknown;
}

function NotSyncedOverview({
  integrations,
  checklist,
  now,
  onStep,
  syncing,
  syncError,
}: NotSyncedProps) {
  // The checklist already says what to connect; what is left to report is why a first sync did not arrive.
  const notices = (integrations.data ? freshnessNotices(integrations.data, now) : []).filter(
    (notice) => notice.kind === 'failure' || notice.kind === 'overdue',
  );

  return (
    <>
      <Band first>
        <Intro
          headline="Your portfolio is not here yet."
          lede="Connect eToro to bring in your holdings, and TipRanks to see analyst signals for them. The first sync fills this page."
        />
        {notices.length > 0 || syncError ? (
          <View style={[styles.block, styles.notices]}>
            {syncError ? (
              <Notice
                tone={isApiError(syncError) && syncError.status === 429 ? 'warning' : 'danger'}
                title="Couldn't start the eToro sync"
              >
                {describeError(syncError)}
              </Notice>
            ) : null}
            <FreshnessNotices notices={notices} />
          </View>
        ) : null}
      </Band>

      <Band tone="sheet">
        <View style={styles.section}>
          <Heading level={2}>Get started</Heading>
          {integrations.isPending ? (
            <LoadingRegion label="Loading your connections">
              <SkeletonBlock height={72} />
              <SkeletonBlock height={72} />
              <SkeletonBlock height={72} />
            </LoadingRegion>
          ) : integrations.isError ? (
            <ErrorState
              error={integrations.error}
              title="Couldn't load your connections"
              onRetry={() => void integrations.refetch()}
            />
          ) : checklist ? (
            <GetStarted steps={checklist} onAction={onStep} syncing={syncing} />
          ) : null}
        </View>
      </Band>
    </>
  );
}

/** The answer first: what the analysts say about the positions that matter, then what to look at and why. */
export function OverviewScreen() {
  const now = useNow();
  const router = useRouter();
  const toast = useToast();
  const me = useMe();
  const analysis = useAnalysis();
  const portfolio = usePortfolio();
  const integrations = useIntegrations();
  const runs = useSyncRuns();
  const requestSync = useRequestSync();
  const [pulling, setPulling] = useState(false);

  async function refresh() {
    setPulling(true);
    await Promise.allSettled([
      analysis.refetch(),
      portfolio.refetch(),
      integrations.refetch(),
      runs.refetch(),
    ]);
    setPulling(false);
  }

  const openConnections = () => router.push('/connections');
  const allowsManualSync = me.data?.allowsManualSync ?? true;

  function onStep(step: ChecklistStep) {
    if (step.action?.to === 'sync') {
      requestSync.mutate('Etoro', { onSuccess: () => toast.show('eToro sync queued.') });
    } else {
      openConnections();
    }
  }

  return (
    <Screen refreshing={pulling} onRefresh={() => void refresh()}>
      <PageTitle title="Overview" />
      {analysis.isPending ? (
        <OverviewSkeleton />
      ) : analysis.isError ? (
        <Band first>
          <ErrorState
            error={analysis.error}
            title="Couldn't load your overview"
            onRetry={() => void analysis.refetch()}
          />
        </Band>
      ) : analysis.data === null ? (
        <NotSyncedOverview
          integrations={integrations}
          checklist={
            integrations.data
              ? buildChecklist(integrations.data, runs.data, allowsManualSync)
              : null
          }
          now={now}
          onStep={onStep}
          syncing={requestSync.isPending}
          syncError={requestSync.isError ? requestSync.error : null}
        />
      ) : (
        <SyncedOverview
          analysis={analysis.data}
          portfolio={{ pending: portfolio.isPending, account: portfolio.data?.account }}
          integrations={integrations.data}
          now={now}
          onOpenConnections={openConnections}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: { gap: space.md },
  headline: { maxWidth: 900 },
  lede: { maxWidth: 640 },
  meta: { flexDirection: 'row', flexWrap: 'wrap', columnGap: space.xl, rowGap: space.xxs },
  metaCompact: { flexDirection: 'column' },
  block: { marginTop: space.xl },
  notices: { gap: space.md },
  section: { gap: space.lg },
  sectionLede: { maxWidth: 640 },
  skeletonStrip: { marginTop: space.lg },
  footer: { gap: space.xs },
  disclaimer: { maxWidth: 720 },
});
