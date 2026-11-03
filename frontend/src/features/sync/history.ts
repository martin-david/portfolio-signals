import type { IntegrationDto, SyncFailureKind, SyncRunDto, SyncRunStatus } from '@/api/schema';
import { providerLabel } from '@/features/integrations/freshness';
import {
  describeInterval,
  formatDateTime,
  formatNumber,
  formatRelative,
  plural,
} from '@/lib/format';
import type { StatusTone } from '@/ui';

import { isActiveRun, manualSyncCooldownMinutes } from './runs';

export type { StatusTone };

export const runStatusLabel: Record<SyncRunStatus, string> = {
  Queued: 'Queued',
  Running: 'Running',
  Succeeded: 'Succeeded',
  Failed: 'Failed',
  Skipped: 'Skipped',
};

export function runStatusTone(run: Pick<SyncRunDto, 'status' | 'failure'>): StatusTone {
  switch (run.status) {
    case 'Succeeded':
      return 'positive';
    case 'Failed':
      return run.failure?.kind === 'Unauthorized' ? 'danger' : 'warning';
    default:
      return 'neutral';
  }
}

export const failureKindLabel: Record<SyncFailureKind, string> = {
  Unauthorized: 'Credentials rejected',
  RateLimited: 'Rate limited',
  Unavailable: 'Provider unavailable',
  InvalidResponse: 'Unreadable response',
  Unknown: 'Unexpected error',
};

/** "12 seconds", "1 minute 4 seconds"; null while the run has not both started and finished. */
export function runDuration(run: Pick<SyncRunDto, 'startedAt' | 'completedAt'>): string | null {
  if (!run.startedAt || !run.completedAt) {
    return null;
  }
  const seconds = Math.round((Date.parse(run.completedAt) - Date.parse(run.startedAt)) / 1000);
  if (!Number.isFinite(seconds) || seconds < 0) {
    return null;
  }
  if (seconds < 60) {
    return `${seconds} ${plural(seconds, 'second')}`;
  }
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  const head = `${minutes} ${plural(minutes, 'minute')}`;
  return rest === 0 ? head : `${head} ${rest} ${plural(rest, 'second')}`;
}

export interface RunDescription {
  title: string;
  statusLabel: string;
  tone: StatusTone;
  /** "2 hours ago" */
  when: string;
  /** The same moment, exact, for assistive technology and tooltips. */
  whenExact: string;
  detail: string;
}

export function describeRun(run: SyncRunDto, now: Date): RunDescription {
  const duration = runDuration(run);
  let detail: string;
  switch (run.status) {
    case 'Queued':
      detail = 'Waiting for its turn.';
      break;
    case 'Running':
      detail = 'In progress.';
      break;
    case 'Succeeded':
      detail = `${formatNumber(run.itemsProcessed)} ${plural(run.itemsProcessed, 'item')} processed${
        duration ? ` in ${duration}` : ''
      }.`;
      break;
    case 'Skipped':
      detail = run.skipReason ?? 'Nothing to do.';
      break;
    default:
      detail = run.failure
        ? `${failureKindLabel[run.failure.kind]}: ${run.failure.message}`
        : 'The sync did not finish.';
  }
  return {
    title: `${providerLabel(run.provider)} ${run.trigger === 'Manual' ? 'manual sync' : 'scheduled sync'}`,
    statusLabel: runStatusLabel[run.status],
    tone: runStatusTone(run),
    when: formatRelative(run.requestedAt, now),
    whenExact: formatDateTime(run.requestedAt),
    detail,
  };
}

export type SyncControl =
  /** There is no active connection to sync. */
  | { kind: 'unavailable' }
  /** A run is queued or running: scheduled or manual. */
  | { kind: 'running'; status: 'Queued' | 'Running' }
  /** The plan syncs on a schedule only. */
  | { kind: 'scheduled-only'; interval: string }
  /** A manual sync was made too recently; the server remains the authority. */
  | { kind: 'cooldown'; minutes: number }
  | { kind: 'ready' };

/** What the Sync now button of a provider card should offer, from what the client knows. */
export function syncControl(input: {
  integration: IntegrationDto;
  runs: readonly SyncRunDto[] | undefined;
  allowsManualSync: boolean;
  now: Date;
}): SyncControl {
  const { integration, runs, allowsManualSync, now } = input;
  if (integration.status !== 'Active') {
    return { kind: 'unavailable' };
  }
  const active = runs?.find((run) => run.provider === integration.provider && isActiveRun(run));
  if (active) {
    return { kind: 'running', status: active.status as 'Queued' | 'Running' };
  }
  if (!allowsManualSync) {
    return { kind: 'scheduled-only', interval: describeInterval(integration.syncIntervalMinutes) };
  }
  const minutes = manualSyncCooldownMinutes(integration.provider, runs, integration, now);
  return minutes > 0 ? { kind: 'cooldown', minutes } : { kind: 'ready' };
}
