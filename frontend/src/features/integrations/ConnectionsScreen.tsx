import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { describeError } from '@/api/errors';
import type { IntegrationProvider } from '@/api/schema';
import { useMe } from '@/features/profile/hooks';
import { useSnapshots } from '@/features/portfolio/hooks';
import { useRequestSync, useSyncRuns } from '@/features/sync/hooks';
import { SyncHistory } from '@/features/sync/SyncHistory';
import { useNow } from '@/lib/useNow';
import { PageTitle } from '@/shell/PageTitle';
import {
  Band,
  ConfirmDialog,
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

import { freshnessNotices, providerLabel } from './freshness';
import { useDisconnectProvider, useIntegrations } from './hooks';
import { ProviderCard } from './ProviderCard';
import { SnapshotList } from './SnapshotList';

function CardsSkeleton() {
  return (
    <LoadingRegion label="Loading connections">
      <SkeletonBlock height={240} />
      <SkeletonBlock height={240} />
    </LoadingRegion>
  );
}

function ListSkeleton({ label }: { label: string }) {
  return (
    <LoadingRegion label={label}>
      <SkeletonBlock height={56} />
      <SkeletonBlock height={56} />
      <SkeletonBlock height={56} />
    </LoadingRegion>
  );
}

/** eToro and TipRanks: connect, replace or remove credentials, sync on demand, and see how recent syncs went. */
export function ConnectionsScreen() {
  const now = useNow();
  const breakpoint = useBreakpoint();
  const toast = useToast();
  const me = useMe();
  const integrations = useIntegrations();
  const runs = useSyncRuns();
  const snapshots = useSnapshots();
  const requestSync = useRequestSync();
  const disconnect = useDisconnectProvider();

  const [formFor, setFormFor] = useState<IntegrationProvider | null>(null);
  const [confirming, setConfirming] = useState<IntegrationProvider | null>(null);
  const [pulling, setPulling] = useState(false);

  // The profile says whether the plan allows manual syncs. When it cannot be read the server stays the authority.
  const allowsManualSync = me.data?.allowsManualSync ?? true;

  async function refresh() {
    setPulling(true);
    await Promise.allSettled([integrations.refetch(), runs.refetch(), snapshots.refetch()]);
    setPulling(false);
  }

  function sync(provider: IntegrationProvider) {
    requestSync.mutate(provider, {
      onSuccess: () => toast.show(`${providerLabel(provider)} sync queued.`),
    });
  }

  function connected(provider: IntegrationProvider) {
    setFormFor(null);
    toast.show(
      allowsManualSync
        ? `${providerLabel(provider)} connected. Use Sync now to fetch your data.`
        : `${providerLabel(provider)} connected. Your first sync runs on your plan's schedule.`,
    );
  }

  function confirmDisconnect() {
    if (!confirming) {
      return;
    }
    const provider = confirming;
    disconnect.mutate(provider, {
      onSuccess: () => toast.show(`${providerLabel(provider)} disconnected.`),
      onSettled: () => {
        setConfirming(null);
        setFormFor((open) => (open === provider ? null : open));
      },
    });
  }

  const notices = integrations.data
    ? freshnessNotices(integrations.data, now, { includeNotConnected: false })
    : [];
  const compact = breakpoint === 'compact';

  return (
    <Screen refreshing={pulling} onRefresh={() => void refresh()}>
      <PageTitle title="Connections" />
      <Band first>
        <View style={styles.intro}>
          <Heading level={1}>Connections</Heading>
          <Text tone="muted">
            Where your data comes from, and when it was last brought up to date. Each provider is
            used with your own keys.
          </Text>
        </View>
      </Band>

      {notices.length > 0 || disconnect.isError ? (
        <Band padding="tight">
          <View style={styles.notices}>
            {disconnect.isError ? (
              <Notice
                tone="danger"
                title={`Couldn't disconnect ${disconnect.variables ? providerLabel(disconnect.variables) : 'the provider'}`}
              >
                {describeError(disconnect.error)}
              </Notice>
            ) : null}
            {notices.map((notice) => (
              <Notice
                key={notice.id}
                tone={notice.tone}
                title={notice.title}
                action={
                  notice.action === 'reconnect' && formFor !== notice.provider
                    ? { label: 'Reconnect', onPress: () => setFormFor(notice.provider) }
                    : undefined
                }
              >
                {notice.body}
              </Notice>
            ))}
          </View>
        </Band>
      ) : null}

      <Band tone="sheet">
        {integrations.isPending || me.isPending ? (
          <CardsSkeleton />
        ) : integrations.isError ? (
          <ErrorState
            error={integrations.error}
            title="Couldn't load your connections"
            onRetry={() => void integrations.refetch()}
          />
        ) : (
          <View style={[styles.cards, compact && styles.cardsCompact]}>
            {integrations.data.map((integration) => (
              <View key={integration.provider} style={styles.card}>
                <ProviderCard
                  integration={integration}
                  runs={runs.data}
                  allowsManualSync={allowsManualSync}
                  now={now}
                  syncing={requestSync.isPending && requestSync.variables === integration.provider}
                  syncError={
                    requestSync.isError && requestSync.variables === integration.provider
                      ? requestSync.error
                      : null
                  }
                  formOpen={formFor === integration.provider}
                  onSync={() => sync(integration.provider)}
                  onOpenForm={() => setFormFor(integration.provider)}
                  onCloseForm={() => setFormFor(null)}
                  onConnected={() => connected(integration.provider)}
                  onDisconnect={() => setConfirming(integration.provider)}
                />
              </View>
            ))}
          </View>
        )}
      </Band>

      <Band>
        <View style={styles.section}>
          <Heading level={2}>Sync history</Heading>
          <Text tone="muted">
            Syncs run on your plan&apos;s schedule and whenever you ask. Providers limit how often
            they can be called, so a sync can be delayed or skipped.
          </Text>
          {runs.isPending ? (
            <ListSkeleton label="Loading sync history" />
          ) : runs.isError ? (
            <ErrorState
              error={runs.error}
              title="Couldn't load the sync history"
              onRetry={() => void runs.refetch()}
            />
          ) : runs.data.length === 0 ? (
            <EmptyState title="No syncs yet">
              Connect a provider, then use Sync now. Scheduled syncs follow your plan.
            </EmptyState>
          ) : (
            <SyncHistory runs={runs.data} now={now} />
          )}
        </View>
      </Band>

      <Band tone="sheet">
        <View style={styles.section}>
          <Heading level={2}>Saved snapshots</Heading>
          <Text tone="muted">
            Each successful eToro sync saves your portfolio as it was. The analysis always uses the
            latest one.
          </Text>
          {snapshots.isPending ? (
            <ListSkeleton label="Loading snapshots" />
          ) : snapshots.isError ? (
            <ErrorState
              error={snapshots.error}
              title="Couldn't load the snapshots"
              onRetry={() => void snapshots.refetch()}
            />
          ) : snapshots.data.length === 0 ? (
            <EmptyState title="No snapshots yet">
              The first successful eToro sync saves one.
            </EmptyState>
          ) : (
            <SnapshotList snapshots={snapshots.data} />
          )}
        </View>
      </Band>

      <ConfirmDialog
        visible={confirming !== null}
        title={`Disconnect ${confirming ? providerLabel(confirming) : ''}?`}
        message="Syncing stops and the stored credentials are deleted. Snapshots already saved are kept, and you can connect again at any time."
        confirmLabel="Disconnect"
        destructive
        busy={disconnect.isPending}
        onConfirm={confirmDisconnect}
        onCancel={() => setConfirming(null)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: { gap: space.sm, maxWidth: 720 },
  notices: { gap: space.md },
  cards: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xl },
  cardsCompact: { flexDirection: 'column', gap: space.lg },
  card: { flexGrow: 1, flexShrink: 1, flexBasis: 420 },
  section: { gap: space.lg },
});
