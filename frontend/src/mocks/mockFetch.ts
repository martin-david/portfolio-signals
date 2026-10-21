import type { FetchLike } from '@/api/createApiClient';
import type { MockScenario } from '@/config/env';

// Replaced by the stateful mock API in the mock-backend step.
export function getMockFetch(scenario: MockScenario): FetchLike {
  return async () => new Response(JSON.stringify({ scenario }), { status: 501 });
}
