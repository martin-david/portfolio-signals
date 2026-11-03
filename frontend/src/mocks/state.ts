import type {
  ConnectionStatus,
  IntegrationProvider,
  SignalData,
  SubscriptionPlan,
  SyncFailure,
  SyncRunDto,
} from '@/api/schema';
import type { MockScenario } from '@/config/env';

import { createDemoData, type DemoData } from './fixtures/demoPortfolio';

export interface MockUser {
  id: string;
  email: string;
  displayName: string;
  plan: SubscriptionPlan;
  registeredAt: string;
}

export interface MockConnection {
  status: ConnectionStatus | null;
  connectedAt: string | null;
  lastAttemptAt: string | null;
  lastSuccessfulSyncAt: string | null;
  syncRequestedAt: string | null;
  retryNotBefore: string | null;
  lastFailure: SyncFailure | null;
}

export interface MockSnapshot {
  id: string;
  takenAt: string;
  data: DemoData;
}

export interface MockSignals {
  data: SignalData;
  fetchedAt: string;
}

export interface MockState {
  scenario: MockScenario;
  user: MockUser | null;
  connections: Record<IntegrationProvider, MockConnection>;
  runs: SyncRunDto[];
  snapshots: MockSnapshot[];
  signals: Record<string, MockSignals>;
  /** Successful eToro syncs so far: each one moves the demo values a little so a sync visibly changes something. */
  etoroSyncs: number;
  runCounter: number;
}

export const PLAN_INTERVAL_MINUTES = 7 * 24 * 60;

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

export function snapshotId(takenAt: string): string {
  return takenAt.replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
}

export function normalizeTicker(ticker: string): string {
  return ticker.trim().toUpperCase();
}

function never(): MockConnection {
  return {
    status: null,
    connectedAt: null,
    lastAttemptAt: null,
    lastSuccessfulSyncAt: null,
    syncRequestedAt: null,
    retryNotBefore: null,
    lastFailure: null,
  };
}

const iso = (time: number) => new Date(time).toISOString();

export function signalsFrom(data: DemoData, fetchedAt: string): Record<string, MockSignals> {
  const signals: Record<string, MockSignals> = {};
  for (const { signals: bySymbol } of data.holdings) {
    for (const [ticker, value] of Object.entries(bySymbol)) {
      signals[normalizeTicker(ticker)] = { data: value, fetchedAt };
    }
  }
  return signals;
}

function takeSnapshot(now: Date, ageMs: number, syncs: number): MockSnapshot {
  const takenAt = iso(now.getTime() - ageMs);
  return {
    id: snapshotId(takenAt),
    takenAt,
    data: createDemoData(new Date(takenAt), 0.011 * syncs),
  };
}

function historicRun(
  state: MockState,
  provider: IntegrationProvider,
  completedAt: number,
  status: SyncRunDto['status'],
  items: number,
  failure: SyncFailure | null = null,
): void {
  state.runCounter += 1;
  state.runs.push({
    id: `demo-run-${String(state.runCounter).padStart(3, '0')}`,
    provider,
    trigger: 'Scheduled',
    status,
    requestedAt: iso(completedAt - 90_000),
    startedAt: iso(completedAt - 60_000),
    completedAt: iso(completedAt),
    itemsProcessed: items,
    failure,
    skipReason: null,
  });
}

/** The state each scenario starts in. */
export function initialState(scenario: MockScenario, now: Date): MockState {
  const t = now.getTime();
  const state: MockState = {
    scenario,
    user: null,
    connections: { Etoro: never(), TipRanks: never() },
    runs: [],
    snapshots: [],
    signals: {},
    etoroSyncs: 0,
    runCounter: 0,
  };
  if (scenario === 'empty') {
    return state;
  }

  state.user = {
    id: 'demo',
    email: 'demo@example.test',
    displayName: 'Demo investor',
    plan: 'Free',
    registeredAt: iso(t - 30 * DAY),
  };

  if (scenario === 'failing') {
    for (const provider of ['Etoro', 'TipRanks'] as const) {
      state.connections[provider] = {
        ...never(),
        status: 'Active',
        connectedAt: iso(t - 10 * 60_000),
      };
    }
    return state;
  }

  const connected = iso(t - 30 * DAY);
  const portfolioAge = scenario === 'credentials-rejected' ? 2 * DAY : 2 * HOUR;
  const signalsAge =
    scenario === 'happy' ? 2 * HOUR + 5 * 60_000 : scenario === 'rate-limited' ? 3 * DAY : 2 * DAY;
  state.etoroSyncs = 1;
  const snapshot = takeSnapshot(now, portfolioAge, 1);
  state.snapshots.push(snapshot);
  state.signals = signalsFrom(snapshot.data, iso(t - signalsAge));

  const etoroSuccess = iso(t - portfolioAge);
  state.connections.Etoro = {
    status: 'Active',
    connectedAt: connected,
    lastAttemptAt: etoroSuccess,
    lastSuccessfulSyncAt: etoroSuccess,
    syncRequestedAt: null,
    retryNotBefore: null,
    lastFailure: null,
  };
  const tipRanksSuccess = iso(t - signalsAge);
  state.connections.TipRanks = {
    status: 'Active',
    connectedAt: connected,
    lastAttemptAt: tipRanksSuccess,
    lastSuccessfulSyncAt: tipRanksSuccess,
    syncRequestedAt: null,
    retryNotBefore: null,
    lastFailure: null,
  };

  historicRun(state, 'Etoro', t - 7 * DAY, 'Succeeded', 15);
  historicRun(state, 'TipRanks', t - 7 * DAY + 5 * 60_000, 'Succeeded', 14);
  historicRun(state, 'Etoro', t - portfolioAge, 'Succeeded', 15);
  historicRun(state, 'TipRanks', t - signalsAge, 'Succeeded', 14);

  if (scenario === 'rate-limited') {
    const failure: SyncFailure = {
      kind: 'RateLimited',
      message: 'TipRanks rate limit reached (HTTP 429). The next attempt is delayed automatically.',
      at: iso(t - 40 * 60_000),
    };
    state.connections.TipRanks = {
      ...state.connections.TipRanks,
      lastAttemptAt: failure.at,
      lastFailure: failure,
      retryNotBefore: iso(t + 80 * 60_000),
    };
    historicRun(state, 'TipRanks', t - 40 * 60_000, 'Failed', 0, failure);
  }

  if (scenario === 'credentials-rejected') {
    const failure: SyncFailure = {
      kind: 'Unauthorized',
      message: 'eToro rejected the stored credentials (HTTP 401). Reconnect to resume syncing.',
      at: iso(t - 3 * HOUR),
    };
    state.connections.Etoro = {
      ...state.connections.Etoro,
      status: 'CredentialsRejected',
      lastAttemptAt: failure.at,
      lastFailure: failure,
    };
    historicRun(state, 'Etoro', t - 3 * HOUR, 'Failed', 0, failure);
  }

  state.runs.sort((a, b) => Date.parse(b.requestedAt) - Date.parse(a.requestedAt));
  return state;
}
