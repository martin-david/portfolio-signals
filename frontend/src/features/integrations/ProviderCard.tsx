import { StyleSheet, View } from 'react-native';

import { describeError, isApiError } from '@/api/errors';
import type { IntegrationDto, SyncRunDto } from '@/api/schema';
import { MANUAL_SYNC_COOLDOWN_MINUTES } from '@/features/sync/runs';
import { failureKindLabel, syncControl } from '@/features/sync/history';
import { describeInterval, formatDate, formatDateTime, formatRelative, plural } from '@/lib/format';
import { Button, Heading, Notice, Panel, StatusLabel, Text, space } from '@/ui';

import { ConnectForm } from './ConnectForm';
import { connectionState, providerLabel } from './freshness';
import { providerRole } from './credentials';

export interface ProviderCardProps {
  integration: IntegrationDto;
  runs: readonly SyncRunDto[] | undefined;
  /** From the plan: some plans sync on a schedule only. */
  allowsManualSync: boolean;
  now: Date;
  /** A manual sync is being requested. */
  syncing: boolean;
  /** Why the last request for a manual sync was refused, if it was. */
  syncError: unknown;
  formOpen: boolean;
  onSync: () => void;
  onOpenForm: () => void;
  onCloseForm: () => void;
  onConnected: () => void;
  onDisconnect: () => void;
}

function Fact({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <View style={styles.fact}>
      <Text variant="small" tone="muted" style={styles.factLabel}>
        {label}
      </Text>
      <View style={styles.factValue}>
        <Text variant="small">{value}</Text>
        {detail ? (
          <Text variant="caption" tone="subtle">
            {detail}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function moment(label: string, value: string | null, now: Date) {
  return value ? (
    <Fact label={label} value={formatRelative(value, now)} detail={formatDateTime(value)} />
  ) : null;
}

/** One provider: where it stands, when it last worked, and what the person can do about it. */
export function ProviderCard({
  integration,
  runs,
  allowsManualSync,
  now,
  syncing,
  syncError,
  formOpen,
  onSync,
  onOpenForm,
  onCloseForm,
  onConnected,
  onDisconnect,
}: ProviderCardProps) {
  const name = providerLabel(integration.provider);
  const state = connectionState(integration);
  const active = integration.status === 'Active';
  const rejected = integration.status === 'CredentialsRejected';
  const control = syncControl({ integration, runs, allowsManualSync, now });
  const { lastFailure } = integration;

  return (
    <Panel padding="roomy" testID={`provider-card-${integration.provider}`}>
      <View style={styles.card}>
        <View style={styles.header}>
          <Heading level={2} variant="heading">
            {name}
          </Heading>
          <StatusLabel tone={state.tone}>{state.label}</StatusLabel>
        </View>
        <Text variant="small" tone="muted">
          {providerRole(integration.provider)}
        </Text>

        {active || rejected ? (
          <View style={styles.facts}>
            {integration.connectedAt ? (
              <Fact label="Connected since" value={formatDate(integration.connectedAt)} />
            ) : null}
            {moment('Last attempt', integration.lastAttemptAt, now)}
            {moment('Last successful sync', integration.lastSuccessfulSyncAt, now)}
            {active ? moment('Next scheduled sync', integration.nextSyncDueAt, now) : null}
            <Fact
              label="Your plan syncs"
              value={describeInterval(integration.syncIntervalMinutes)}
            />
            {lastFailure ? (
              <Fact
                label="Last failure"
                value={`${failureKindLabel[lastFailure.kind]}, ${formatRelative(lastFailure.at, now)}`}
                detail={lastFailure.message}
              />
            ) : null}
          </View>
        ) : null}

        {control.kind === 'running' ? (
          <View accessibilityLiveRegion="polite" style={styles.running}>
            <StatusLabel tone="neutral" icon="sync">
              {control.status === 'Queued' ? 'Sync queued' : 'Syncing now'}
            </StatusLabel>
            <Text variant="caption" tone="subtle">
              This page updates when the sync finishes.
            </Text>
          </View>
        ) : null}
        {control.kind === 'scheduled-only' ? (
          <Text variant="small" tone="muted">
            {`Your plan syncs ${control.interval}. Manual syncs are not part of it.`}
          </Text>
        ) : null}
        {control.kind === 'cooldown' ? (
          <Text variant="small" tone="muted">
            {`Manual syncs are limited to one every ${MANUAL_SYNC_COOLDOWN_MINUTES} minutes. Try again in ${control.minutes} ${plural(control.minutes, 'minute')}.`}
          </Text>
        ) : null}
        {syncError ? (
          <Notice
            tone={isApiError(syncError) && syncError.status === 429 ? 'warning' : 'danger'}
            title={`Couldn't start the ${name} sync`}
          >
            {describeError(syncError)}
          </Notice>
        ) : null}

        {formOpen ? (
          <ConnectForm integration={integration} onConnected={onConnected} onCancel={onCloseForm} />
        ) : (
          <View style={styles.actions}>
            {active && (control.kind === 'ready' || control.kind === 'cooldown') ? (
              <Button
                variant="secondary"
                icon="sync"
                onPress={onSync}
                loading={syncing}
                disabled={control.kind === 'cooldown'}
                testID={`sync-now-${integration.provider}`}
              >
                Sync now
              </Button>
            ) : null}
            {!active && !rejected ? (
              <Button onPress={onOpenForm} testID={`connect-${integration.provider}`}>
                {`Connect ${name}`}
              </Button>
            ) : null}
            {rejected ? (
              <Button onPress={onOpenForm} testID={`reconnect-${integration.provider}`}>
                Reconnect
              </Button>
            ) : null}
            {active ? (
              <Button variant="quiet" onPress={onOpenForm}>
                Replace credentials
              </Button>
            ) : null}
            {active || rejected ? (
              <Button
                variant="quiet"
                onPress={onDisconnect}
                accessibilityLabel={`Disconnect ${name}`}
                testID={`disconnect-${integration.provider}`}
              >
                Disconnect
              </Button>
            ) : null}
          </View>
        )}
      </View>
    </Panel>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.md },
  header: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
  },
  facts: { gap: space.sm, paddingVertical: space.xs },
  fact: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  factLabel: { width: 150 },
  factValue: { flex: 1, minWidth: 140 },
  running: { gap: space.xs },
  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm },
});
