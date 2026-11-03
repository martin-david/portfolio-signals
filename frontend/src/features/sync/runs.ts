import type { IntegrationDto, IntegrationProvider, SyncRunDto } from '@/api/schema';

/** How often the sync history is refreshed while a run is queued or running. */
export const SYNC_POLL_INTERVAL_MS = 4_000;

/** Mirrors SyncPolicy.ManualSyncCooldown in the backend. It is a hint: the server decides. */
export const MANUAL_SYNC_COOLDOWN_MINUTES = 15;

export function isActiveRun(run: Pick<SyncRunDto, 'status'>): boolean {
  return run.status === 'Queued' || run.status === 'Running';
}

export function hasActiveRuns(runs: readonly SyncRunDto[] | undefined): boolean {
  return runs?.some(isActiveRun) ?? false;
}

/** Newest first. A run in `created` replaces the same run already in `existing`. */
export function mergeRuns(
  created: readonly SyncRunDto[],
  existing: readonly SyncRunDto[] | undefined,
): SyncRunDto[] {
  const byId = new Map<string, SyncRunDto>();
  for (const run of existing ?? []) {
    byId.set(run.id, run);
  }
  for (const run of created) {
    byId.set(run.id, run);
  }
  return [...byId.values()].sort((a, b) => Date.parse(b.requestedAt) - Date.parse(a.requestedAt));
}

/** Ids of runs that were active last time and are no longer queued or running. */
export function runsThatFinished(
  previouslyActive: ReadonlySet<string>,
  runs: readonly SyncRunDto[],
): string[] {
  const stillActive = new Set(runs.filter(isActiveRun).map((run) => run.id));
  return [...previouslyActive].filter((id) => !stillActive.has(id));
}

/**
 * Minutes until a manual sync of the provider is allowed again, from the last attempt the client knows about.
 * Zero when it is allowed now.
 */
export function manualSyncCooldownMinutes(
  provider: IntegrationProvider,
  runs: readonly SyncRunDto[] | undefined,
  integration: Pick<IntegrationDto, 'lastAttemptAt'> | undefined,
  now: Date,
): number {
  const stamps = [
    integration?.lastAttemptAt ?? null,
    ...(runs ?? [])
      .filter((run) => run.provider === provider)
      .map((run) => run.startedAt ?? run.requestedAt),
  ]
    .filter((stamp): stamp is string => typeof stamp === 'string')
    .map((stamp) => Date.parse(stamp))
    .filter((time) => !Number.isNaN(time));
  if (stamps.length === 0) {
    return 0;
  }
  const elapsedMinutes = (now.getTime() - Math.max(...stamps)) / 60_000;
  return elapsedMinutes >= MANUAL_SYNC_COOLDOWN_MINUTES
    ? 0
    : Math.ceil(MANUAL_SYNC_COOLDOWN_MINUTES - Math.max(elapsedMinutes, 0));
}
