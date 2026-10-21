import type { FetchLike } from '@/api/createApiClient';
import type { MockScenario } from '@/config/env';

import { createMockBackend, type MockBackend } from './mockBackend';

const DEMO_LATENCY_MS = 180;

let instance: { scenario: MockScenario; backend: MockBackend } | undefined;

/** The one demo backend of this app session; its state survives navigation and sign-in. */
export function getMockBackend(scenario: MockScenario): MockBackend {
  if (!instance || instance.scenario !== scenario) {
    instance = { scenario, backend: createMockBackend({ scenario, latencyMs: DEMO_LATENCY_MS }) };
  }
  return instance.backend;
}

export function getMockFetch(scenario: MockScenario): FetchLike {
  return (request) => getMockBackend(scenario).fetch(request);
}

/** Starts the demo over, for example when the demo user signs out. */
export function resetMockBackend(scenario: MockScenario): void {
  getMockBackend(scenario).reset(scenario);
}
