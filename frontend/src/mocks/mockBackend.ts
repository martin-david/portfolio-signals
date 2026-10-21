/**
 * A stateful stand-in for the backend API (backend/src/PortfolioSignals.Api): the same routes, status codes, problem
 * responses and validation rules, over the fictional demo portfolio. It lets the app run, be demonstrated and be tested
 * without Cosmos DB, Azurite or provider credentials. Nothing here is a real account, a real position or real analyst
 * data, and credentials sent to it are checked for presence and then discarded.
 */
import type { FetchLike } from '@/api/createApiClient';
import type {
  AnalyzedHoldingDto,
  HoldingDetailDto,
  IntegrationDto,
  IntegrationProvider,
  PortfolioAnalysisDto,
  PortfolioDto,
  PortfolioSnapshotSummaryDto,
  SyncFailureKind,
  SyncRunDto,
  UserProfileDto,
} from '@/api/schema';
import type { MockScenario } from '@/config/env';

import { empty, json, pause, problem, unauthorized, validationProblem } from './http';
import { assessHolding, buildKpis } from './scorer';
import {
  PLAN_INTERVAL_MINUTES,
  initialState,
  normalizeTicker,
  signalsFrom,
  snapshotId,
  type MockConnection,
  type MockSnapshot,
  type MockState,
} from './state';
import { createDemoData } from './fixtures/demoPortfolio';

export interface MockBackendOptions {
  scenario?: MockScenario;
  /** The clock; defaults to the real one. */
  now?: () => Date;
  /** Artificial network delay, so loading states are visible in the demo. */
  latencyMs?: number;
  /** How long a manual sync waits in the queue, runs, and waits before the next provider starts. */
  timing?: { queuedMs: number; runningMs: number; gapMs: number };
}

export interface MockBackend {
  fetch: FetchLike;
  /** A copy of the current state, for tests. */
  state(): MockState;
  /** Starts over in a scenario and cancels pending sync runs. */
  reset(scenario?: MockScenario): void;
}

const DEFAULT_TIMING = { queuedMs: 1_200, runningMs: 2_600, gapMs: 400 };
const COOLDOWN_MS = 15 * 60_000;
const DISCLAIMER =
  'Informational only, not investment advice. Verdicts come from documented rules over third-party analyst data; they do not see position size relative to your goals, taxes or time horizon.';
const REQUIRED_FIELDS: Record<IntegrationProvider, string[]> = {
  Etoro: ['apiKey', 'userKey'],
  TipRanks: ['apiKey'],
};
const PROVIDERS: IntegrationProvider[] = ['Etoro', 'TipRanks'];

const FAILURE_MESSAGES: Record<IntegrationProvider, Partial<Record<SyncFailureKind, string>>> = {
  Etoro: { Unavailable: 'eToro is temporarily unavailable (HTTP 503).' },
  TipRanks: {
    Unavailable: 'TipRanks is temporarily unavailable (HTTP 503).',
    RateLimited:
      'TipRanks rate limit reached (HTTP 429). The next attempt is delayed automatically.',
  },
};

function parseUrl(url: string): { path: string; query: Record<string, string> } {
  const match = /^[a-z]+:\/\/[^/?#]*([^?#]*)(?:\?([^#]*))?/i.exec(url);
  const path = (match?.[1] ?? '/').replace(/\/+$/, '') || '/';
  const query: Record<string, string> = {};
  for (const pair of (match?.[2] ?? '').split('&')) {
    if (pair) {
      const [key, value = ''] = pair.split('=');
      query[decodeURIComponent(key)] = decodeURIComponent(value);
    }
  }
  return { path, query };
}

function parseProvider(segment: string): IntegrationProvider | null {
  const lower = decodeURIComponent(segment).toLowerCase();
  return PROVIDERS.find((p) => p.toLowerCase() === lower) ?? null;
}

function nextDueAt(connection: MockConnection): string | null {
  if (connection.status !== 'Active') {
    return null;
  }
  const base = connection.lastSuccessfulSyncAt
    ? Date.parse(connection.lastSuccessfulSyncAt) + PLAN_INTERVAL_MINUTES * 60_000
    : Date.parse(connection.connectedAt ?? new Date().toISOString());
  const retry = connection.retryNotBefore ? Date.parse(connection.retryNotBefore) : 0;
  return new Date(Math.max(base, retry)).toISOString();
}

export function createMockBackend(options: MockBackendOptions = {}): MockBackend {
  const clock = options.now ?? (() => new Date());
  const latencyMs = options.latencyMs ?? 0;
  const timing = options.timing ?? DEFAULT_TIMING;
  const timers = new Set<ReturnType<typeof setTimeout>>();
  let state = initialState(options.scenario ?? 'happy', clock());

  const nowIso = () => clock().toISOString();

  function schedule(action: () => void, delayMs: number): void {
    const timer = setTimeout(() => {
      timers.delete(timer);
      action();
    }, delayMs);
    timers.add(timer);
  }

  function replaceRun(id: string, change: Partial<SyncRunDto>): SyncRunDto | undefined {
    const index = state.runs.findIndex((r) => r.id === id);
    if (index < 0) {
      return undefined;
    }
    state.runs[index] = { ...state.runs[index], ...change };
    return state.runs[index];
  }

  function recordFailure(
    provider: IntegrationProvider,
    kind: SyncFailureKind,
    message: string,
    retryAfterMinutes: number,
  ): void {
    const now = nowIso();
    const connection = state.connections[provider];
    connection.lastAttemptAt = now;
    connection.lastFailure = { kind, message, at: now };
    connection.syncRequestedAt = null;
    if (kind === 'Unauthorized') {
      connection.status = 'CredentialsRejected';
      connection.retryNotBefore = null;
    } else {
      connection.retryNotBefore = new Date(
        clock().getTime() + retryAfterMinutes * 60_000,
      ).toISOString();
    }
  }

  function finishRun(runId: string): void {
    const run = state.runs.find((r) => r.id === runId);
    if (!run) {
      return;
    }
    const provider = run.provider;
    const connection = state.connections[provider];
    const now = nowIso();

    if (connection.status !== 'Active') {
      replaceRun(runId, {
        status: 'Skipped',
        completedAt: now,
        skipReason: 'The connection is not active.',
      });
      return;
    }

    const unavailable = state.scenario === 'failing';
    const rateLimited = state.scenario === 'rate-limited' && provider === 'TipRanks';
    if (unavailable || rateLimited) {
      const kind: SyncFailureKind = rateLimited ? 'RateLimited' : 'Unavailable';
      const message = FAILURE_MESSAGES[provider][kind] ?? 'The provider failed.';
      recordFailure(provider, kind, message, rateLimited ? 90 : 5);
      replaceRun(runId, {
        status: 'Failed',
        completedAt: now,
        failure: { kind, message, at: now },
      });
      return;
    }

    if (provider === 'TipRanks' && state.snapshots.length === 0) {
      connection.syncRequestedAt = null;
      connection.retryNotBefore = new Date(clock().getTime() + COOLDOWN_MS).toISOString();
      replaceRun(runId, {
        status: 'Skipped',
        completedAt: now,
        skipReason: 'No portfolio snapshot yet; synchronize eToro first.',
      });
      return;
    }

    let items: number;
    if (provider === 'Etoro') {
      state.etoroSyncs += 1;
      const takenAt = now;
      const snapshot: MockSnapshot = {
        id: snapshotId(takenAt),
        takenAt,
        data: createDemoData(clock(), 0.011 * state.etoroSyncs),
      };
      state.snapshots = [...state.snapshots.filter((s) => s.id !== snapshot.id), snapshot].slice(
        -20,
      );
      items = snapshot.data.holdings.length;
    } else {
      const latest = state.snapshots[state.snapshots.length - 1];
      state.signals = { ...state.signals, ...signalsFrom(latest.data, now) };
      items = Object.keys(state.signals).length;
    }

    connection.lastAttemptAt = now;
    connection.lastSuccessfulSyncAt = now;
    connection.lastFailure = null;
    connection.retryNotBefore = null;
    connection.syncRequestedAt = null;
    replaceRun(runId, { status: 'Succeeded', completedAt: now, itemsProcessed: items });
  }

  function startLifecycle(runs: SyncRunDto[]): void {
    let offset = 0;
    for (const run of [...runs].sort((a, b) => a.provider.localeCompare(b.provider))) {
      const startAt = offset + timing.queuedMs;
      schedule(() => replaceRun(run.id, { status: 'Running', startedAt: nowIso() }), startAt);
      schedule(() => finishRun(run.id), startAt + timing.runningMs);
      offset = startAt + timing.runningMs + timing.gapMs;
    }
  }

  // ----- views -----

  function profile(): UserProfileDto {
    const user = state.user!;
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      plan: user.plan,
      etoroSyncIntervalMinutes: PLAN_INTERVAL_MINUTES,
      tipRanksSyncIntervalMinutes: PLAN_INTERVAL_MINUTES,
      allowsManualSync: true,
      registeredAt: user.registeredAt,
    };
  }

  function integration(provider: IntegrationProvider): IntegrationDto {
    const c = state.connections[provider];
    return {
      provider,
      status: c.status,
      syncIntervalMinutes: PLAN_INTERVAL_MINUTES,
      connectedAt: c.connectedAt,
      lastAttemptAt: c.lastAttemptAt,
      lastSuccessfulSyncAt: c.lastSuccessfulSyncAt,
      nextSyncDueAt: nextDueAt(c),
      lastFailure: c.lastFailure,
      requiredCredentialFields: REQUIRED_FIELDS[provider],
    };
  }

  function latestSnapshot(): MockSnapshot | undefined {
    return state.snapshots[state.snapshots.length - 1];
  }

  function analysisRows(snapshot: MockSnapshot): AnalyzedHoldingDto[] {
    const today = nowIso().slice(0, 10);
    return [...snapshot.data.holdings]
      .sort((a, b) => b.holding.value - a.holding.value)
      .map(({ holding, related }) => {
        const primary = state.signals[normalizeTicker(holding.tipRanksTicker)]?.data ?? null;
        const relatedTicker = related.find((t) => state.signals[normalizeTicker(t)]) ?? null;
        const relatedSignals = relatedTicker
          ? (state.signals[normalizeTicker(relatedTicker)]?.data ?? null)
          : null;
        return {
          holding,
          assessment: assessHolding(
            holding,
            holding.weightPct,
            primary,
            relatedSignals,
            relatedTicker,
            today,
          ),
        };
      });
  }

  function signalsFetchedAt(): string | null {
    const stamps = Object.values(state.signals).map((s) => s.fetchedAt);
    return stamps.length > 0 ? stamps.reduce((min, s) => (s < min ? s : min)) : null;
  }

  // ----- routes -----

  const notRegistered = () =>
    problem(404, 'The user has not registered a profile yet.', 'user.not_registered');
  const notSynced = () =>
    problem(404, 'No portfolio has been synchronized yet.', 'portfolio.not_synced');

  function takeParameter(query: Record<string, string>): number | Response {
    const raw = query.take ?? '20';
    const take = Number(raw);
    if (!Number.isInteger(take) || take < 1 || take > 100) {
      return validationProblem({ Take: [`'Take' must be between 1 and 100. You entered ${raw}.`] });
    }
    return take;
  }

  async function handle(request: Request): Promise<Response> {
    await pause(latencyMs);
    const { path, query } = parseUrl(request.url);
    const method = request.method.toUpperCase();
    if (!path.startsWith('/api/v1/')) {
      return problem(404, 'Not Found');
    }

    const devUser = request.headers.get('x-dev-user')?.trim();
    const bearer = request.headers.get('authorization')?.startsWith('Bearer ');
    if (!devUser && !bearer) {
      return unauthorized();
    }
    const route = path.slice('/api/v1'.length);

    if (route === '/me') {
      if (method === 'GET') {
        return state.user ? json(200, profile()) : notRegistered();
      }
      if (method === 'PUT') {
        const body = ((await request.json().catch(() => null)) ?? {}) as {
          displayName?: string | null;
          email?: string | null;
        };
        const name = (
          body.displayName ??
          state.user?.displayName ??
          devUser ??
          'Demo investor'
        ).trim();
        const email = (
          body.email ??
          state.user?.email ??
          (devUser ? `${devUser}@example.test` : '')
        ).trim();
        const errors: Record<string, string[]> = {};
        if (!email) {
          errors.Email = ["'Email' must not be empty."];
        } else if (email.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          errors.Email = ["'Email' is not a valid email address."];
        }
        if (!name) {
          errors.DisplayName = ["'Display Name' must not be empty."];
        } else if (name.length > 100) {
          errors.DisplayName = [
            `The length of 'Display Name' must be 100 characters or fewer. You entered ${name.length} characters.`,
          ];
        }
        if (Object.keys(errors).length > 0) {
          return validationProblem(errors);
        }
        state.user = {
          id: state.user?.id ?? devUser ?? 'demo',
          email,
          displayName: name,
          plan: state.user?.plan ?? 'Free',
          registeredAt: state.user?.registeredAt ?? nowIso(),
        };
        return json(200, profile());
      }
    }

    if (route === '/integrations' && method === 'GET') {
      return state.user ? json(200, PROVIDERS.map(integration)) : notRegistered();
    }

    const integrationMatch = /^\/integrations\/([^/]+)$/.exec(route);
    if (integrationMatch && (method === 'PUT' || method === 'DELETE')) {
      const provider = parseProvider(integrationMatch[1]);
      if (!provider) {
        return validationProblem({
          provider: [`The value '${integrationMatch[1]}' is not valid.`],
        });
      }
      if (method === 'PUT') {
        if (!state.user) {
          return notRegistered();
        }
        const body = ((await request.json().catch(() => null)) ?? {}) as {
          credentials?: Record<string, string>;
        };
        const credentials = body.credentials ?? {};
        const missing = REQUIRED_FIELDS[provider].filter(
          (field) =>
            !Object.entries(credentials).some(
              ([key, value]) => key.toLowerCase() === field.toLowerCase() && value.trim() !== '',
            ),
        );
        if (missing.length > 0) {
          return validationProblem({
            Credentials: [
              `Credentials for ${provider} must include: ${REQUIRED_FIELDS[provider].join(', ')}.`,
            ],
          });
        }
        if (Object.values(credentials).some((value) => value.length > 2048)) {
          return validationProblem({
            Credentials: ['Credential values must not exceed 2048 characters.'],
          });
        }
        const previous = state.connections[provider];
        state.connections[provider] = {
          ...previous,
          status: 'Active',
          connectedAt: nowIso(),
          syncRequestedAt: null,
          lastFailure: null,
          retryNotBefore: null,
        };
        return json(200, integration(provider));
      }
      const connection = state.connections[provider];
      if (connection.status === null || connection.status === 'Disconnected') {
        return problem(404, `${provider} is not connected.`, 'integration.not_connected');
      }
      connection.status = 'Disconnected';
      connection.syncRequestedAt = null;
      return empty(204);
    }

    if (route === '/sync' && method === 'POST') {
      if (!state.user) {
        return notRegistered();
      }
      const body = ((await request.json().catch(() => null)) ?? null) as {
        provider?: IntegrationProvider | null;
      } | null;
      const wanted = body?.provider ?? null;
      const targets = PROVIDERS.filter(
        (p) => state.connections[p].status === 'Active' && (wanted === null || p === wanted),
      );
      if (targets.length === 0) {
        return problem(
          404,
          'There is no active connection to synchronize.',
          'sync.no_active_connection',
        );
      }
      const now = clock().getTime();
      for (const provider of targets) {
        const c = state.connections[provider];
        const last = Math.max(
          Date.parse(c.lastAttemptAt ?? '') || 0,
          Date.parse(c.syncRequestedAt ?? '') || 0,
        );
        if (last > 0 && now - last < COOLDOWN_MS) {
          const wait = Math.ceil((COOLDOWN_MS - (now - last)) / 60_000);
          return problem(
            429,
            `${provider} was synchronized recently. Try again in about ${wait} minute(s).`,
            'sync.cooldown',
          );
        }
      }
      const created: SyncRunDto[] = targets.map((provider) => {
        state.runCounter += 1;
        const run: SyncRunDto = {
          id: `mock-run-${String(state.runCounter).padStart(3, '0')}`,
          provider,
          trigger: 'Manual',
          status: 'Queued',
          requestedAt: nowIso(),
          startedAt: null,
          completedAt: null,
          itemsProcessed: 0,
          failure: null,
          skipReason: null,
        };
        state.runs = [run, ...state.runs];
        state.connections[provider].syncRequestedAt = run.requestedAt;
        return run;
      });
      // Runs requested together keep their provider order (eToro, then TipRanks) at the top of the history.
      state.runs = [...created, ...state.runs.filter((r) => !created.includes(r))];
      startLifecycle(created);
      return json(202, created);
    }

    if (route === '/sync/runs' && method === 'GET') {
      const take = takeParameter(query);
      return typeof take === 'number' ? json(200, state.runs.slice(0, take)) : take;
    }

    if (route === '/portfolio' && method === 'GET') {
      const snapshot = latestSnapshot();
      if (!snapshot) {
        return notSynced();
      }
      const dto: PortfolioDto = {
        snapshotId: snapshot.id,
        takenAt: snapshot.takenAt,
        lastSuccessfulSyncAt: state.connections.Etoro.lastSuccessfulSyncAt,
        account: snapshot.data.account,
        holdings: snapshot.data.holdings.map((h) => h.holding),
        copiedTraders: snapshot.data.copiedTraders,
      };
      return json(200, dto);
    }

    if (route === '/portfolio/snapshots' && method === 'GET') {
      const take = takeParameter(query);
      if (typeof take !== 'number') {
        return take;
      }
      const summaries: PortfolioSnapshotSummaryDto[] = [...state.snapshots]
        .reverse()
        .slice(0, take)
        .map((s) => ({
          snapshotId: s.id,
          takenAt: s.takenAt,
          totalValue: s.data.account.totalValue,
          positions: s.data.holdings.length,
        }));
      return json(200, summaries);
    }

    if (route === '/portfolio/analysis' && method === 'GET') {
      const snapshot = latestSnapshot();
      if (!snapshot) {
        return notSynced();
      }
      const rows = analysisRows(snapshot);
      const dto: PortfolioAnalysisDto = {
        snapshotId: snapshot.id,
        asOf: snapshot.takenAt,
        signalsFetchedAt: signalsFetchedAt(),
        kpis: buildKpis(rows, snapshot.data.account),
        holdings: rows,
        disclaimer: DISCLAIMER,
      };
      return json(200, dto);
    }

    const holdingMatch = /^\/portfolio\/holdings\/([^/]+)$/.exec(route);
    if (holdingMatch && method === 'GET') {
      const snapshot = latestSnapshot();
      if (!snapshot) {
        return notSynced();
      }
      const symbol = decodeURIComponent(holdingMatch[1]);
      const row = analysisRows(snapshot).find(
        (r) => r.holding.symbol.toLowerCase() === symbol.toLowerCase(),
      );
      if (!row) {
        return problem(404, `The latest snapshot has no holding '${symbol}'.`, 'holding.not_found');
      }
      const stored = state.signals[normalizeTicker(row.holding.tipRanksTicker)];
      const dto: HoldingDetailDto = {
        analysis: row,
        signals: stored?.data ?? null,
        signalsFetchedAt: stored?.fetchedAt ?? null,
      };
      return json(200, dto);
    }

    return problem(404, 'Not Found');
  }

  return {
    fetch: (request) => handle(request),
    state: () => JSON.parse(JSON.stringify(state)) as MockState,
    reset(scenario) {
      for (const timer of timers) {
        clearTimeout(timer);
      }
      timers.clear();
      state = initialState(scenario ?? state.scenario, clock());
    },
  };
}
