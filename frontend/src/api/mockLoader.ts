import type { MockScenario } from '@/config/env';

import type { FetchLike } from './createApiClient';

/** What the app needs from the demo API. The implementation lives in src/mocks and is never imported statically. */
export interface DemoApi {
  getMockFetch(scenario: MockScenario): FetchLike;
  /** Starts the demo over, for example when the demo user signs out. */
  resetMockBackend(scenario: MockScenario): void;
}

/**
 * The only door to src/mocks. The demo API is required inside a branch on EXPO_PUBLIC_API_MODE: Metro inlines that
 * variable when it builds, so in a production build that is not a demo build the branch, and the demo data with it,
 * is dropped from the bundle. (Dynamic import() would not do: it splits the web bundle but not the native one, and
 * Jest cannot run it.)
 */
export function loadDemoApi(): DemoApi {
  if (process.env.EXPO_PUBLIC_API_MODE === 'mock') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('@/mocks/mockFetch') as DemoApi;
  }
  throw new Error(
    'The demo API is not part of this build. Build with EXPO_PUBLIC_API_MODE=mock to include it.',
  );
}
