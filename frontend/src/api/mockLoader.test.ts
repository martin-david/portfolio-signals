import type { AppConfig } from '@/config/env';

import { createApiClient } from './createApiClient';
import { loadDemoApi } from './mockLoader';
import { unwrap } from './request';

const demoConfig: AppConfig = {
  apiMode: 'mock',
  apiBaseUrl: 'https://mock.invalid',
  authMode: 'mock',
  oidc: null,
  mockScenario: 'happy',
};

describe('the demo API loader', () => {
  const original = process.env.EXPO_PUBLIC_API_MODE;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.EXPO_PUBLIC_API_MODE;
    } else {
      process.env.EXPO_PUBLIC_API_MODE = original;
    }
  });

  it('refuses to hand out the demo API in a build that is not a demo build', () => {
    delete process.env.EXPO_PUBLIC_API_MODE;

    expect(() => loadDemoApi()).toThrow(/not part of this build/);
  });

  it('hands it out in a demo build', () => {
    process.env.EXPO_PUBLIC_API_MODE = 'mock';

    const demo = loadDemoApi();

    expect(typeof demo.getMockFetch).toBe('function');
    expect(typeof demo.resetMockBackend).toBe('function');
  });

  it('lets the client reach the demo backend, which wants to know who is asking', async () => {
    process.env.EXPO_PUBLIC_API_MODE = 'mock';
    const signedIn = createApiClient({
      config: demoConfig,
      getAuthHeaders: async () => ({ Authorization: 'Bearer demo-session' }),
    });
    const anonymous = createApiClient({ config: demoConfig, getAuthHeaders: async () => ({}) });

    const me = await unwrap(signedIn.GET('/api/v1/me'));
    const refused = await anonymous.GET('/api/v1/me');

    expect(me).toMatchObject({ displayName: 'Demo investor' });
    expect(refused.response.status).toBe(401);
  });
});
