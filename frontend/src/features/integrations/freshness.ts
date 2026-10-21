import type { IntegrationDto, IntegrationProvider } from '@/api/schema';
import { formatRelative, parseInstant } from '@/lib/format';

export type NoticeTone = 'info' | 'warning' | 'danger';

export interface FreshnessNotice {
  id: string;
  provider: IntegrationProvider;
  kind: 'credentials-rejected' | 'failure' | 'overdue' | 'not-connected';
  tone: NoticeTone;
  title: string;
  body: string;
  /** What the person can do about it. */
  action?: 'reconnect' | 'connect';
}

export function providerLabel(provider: IntegrationProvider): string {
  return provider === 'Etoro' ? 'eToro' : 'TipRanks';
}

/** A sync later than this after it was due is reported; shorter delays are normal queueing. */
export const OVERDUE_GRACE_MS = 30 * 60_000;

const toneRank: Record<NoticeTone, number> = { danger: 0, warning: 1, info: 2 };

function seenFrom(lastSuccessfulSyncAt: string | null, now: Date): string {
  return lastSuccessfulSyncAt
    ? `You are seeing data from ${formatRelative(lastSuccessfulSyncAt, now)}.`
    : 'No sync has succeeded yet.';
}

function failureNotice(integration: IntegrationDto, now: Date): FreshnessNotice | null {
  const { lastFailure, provider, lastSuccessfulSyncAt, nextSyncDueAt } = integration;
  if (!lastFailure) {
    return null;
  }
  const name = providerLabel(provider);
  const seen = seenFrom(lastSuccessfulSyncAt, now);
  const next = nextSyncDueAt ? ` The next attempt is ${formatRelative(nextSyncDueAt, now)}.` : '';
  switch (lastFailure.kind) {
    case 'RateLimited':
      return {
        id: `${provider}:rate-limited`,
        provider,
        kind: 'failure',
        tone: 'warning',
        title: `${name} is rate limiting requests`,
        body: `Providers limit how often data can be fetched, so the app backs off and retries on its own.${next} ${seen}`,
      };
    case 'Unavailable':
      return {
        id: `${provider}:unavailable`,
        provider,
        kind: 'failure',
        tone: 'warning',
        title: `${name} is unavailable`,
        body: `The attempt ${formatRelative(lastFailure.at, now)} did not get through.${next} ${seen}`,
      };
    case 'InvalidResponse':
      return {
        id: `${provider}:invalid-response`,
        provider,
        kind: 'failure',
        tone: 'warning',
        title: `${name} returned data the app could not read`,
        body: `The attempt ${formatRelative(lastFailure.at, now)} will be retried.${next} ${seen}`,
      };
    case 'Unauthorized':
      return null;
    default:
      return {
        id: `${provider}:failed`,
        provider,
        kind: 'failure',
        tone: 'warning',
        title: `The last ${name} sync failed`,
        body: `${formatRelative(lastFailure.at, now)}: ${lastFailure.message}${next} ${seen}`
          .replace(/\s+/g, ' ')
          .trim(),
      };
  }
}

/**
 * What the person should know about the freshness of their data: provider failures and rate limits, rejected
 * credentials, syncs that are later than planned and providers that are not connected. Most urgent first.
 */
export function freshnessNotices(
  integrations: readonly IntegrationDto[],
  now: Date,
  options: { includeNotConnected?: boolean } = {},
): FreshnessNotice[] {
  const notices: FreshnessNotice[] = [];
  for (const integration of integrations) {
    const { provider, status } = integration;
    const name = providerLabel(provider);

    if (status === 'CredentialsRejected') {
      notices.push({
        id: `${provider}:credentials-rejected`,
        provider,
        kind: 'credentials-rejected',
        tone: 'danger',
        title: `${name} rejected your credentials`,
        body: `Syncing is paused until you reconnect. ${seenFrom(integration.lastSuccessfulSyncAt, now)}`,
        action: 'reconnect',
      });
      continue;
    }

    if (status === null || status === 'Disconnected') {
      if (options.includeNotConnected ?? true) {
        notices.push({
          id: `${provider}:not-connected`,
          provider,
          kind: 'not-connected',
          tone: 'info',
          title: `${name} is not connected`,
          body:
            provider === 'Etoro'
              ? 'Connect eToro to bring in your portfolio.'
              : 'Connect TipRanks to see analyst signals for your holdings.',
          action: 'connect',
        });
      }
      continue;
    }

    const failure = failureNotice(integration, now);
    if (failure) {
      notices.push(failure);
      continue;
    }

    const due = parseInstant(integration.nextSyncDueAt);
    if (due && now.getTime() - due.getTime() > OVERDUE_GRACE_MS) {
      notices.push({
        id: `${provider}:overdue`,
        provider,
        kind: 'overdue',
        tone: 'info',
        title: `The ${name} sync is later than planned`,
        body: `It was due ${formatRelative(integration.nextSyncDueAt, now)}. Scheduled syncs can be delayed by provider limits, so the data may be older than your plan's interval.`,
      });
    }
  }
  return notices.sort((a, b) => toneRank[a.tone] - toneRank[b.tone]);
}

export interface ConnectionState {
  label: string;
  tone: 'positive' | 'warning' | 'danger' | 'neutral';
}

export function connectionState(
  integration: Pick<IntegrationDto, 'status' | 'lastFailure'>,
): ConnectionState {
  switch (integration.status) {
    case 'Active':
      return integration.lastFailure
        ? { label: 'Connected, last sync failed', tone: 'warning' }
        : { label: 'Connected', tone: 'positive' };
    case 'CredentialsRejected':
      return { label: 'Credentials rejected', tone: 'danger' };
    case 'Disconnected':
      return { label: 'Disconnected', tone: 'neutral' };
    default:
      return { label: 'Not connected', tone: 'neutral' };
  }
}
