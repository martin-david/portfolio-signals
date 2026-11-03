import { createQueryClient } from '@/api/queryClient';
import { ApiError } from '@/api/errors';
import type { AppConfig } from '@/config/env';

import { createAppServices } from '@/bootstrap';
import { createAuthController } from './controller';
import { createAuthStrategy } from './createStrategy';
import { createDevStrategy } from './devStrategy';
import { createMockStrategy } from './mockStrategy';
import { createMemoryStore } from './storage';
import { AuthError, type AuthStrategy } from './types';

function strategyDouble(overrides: Partial<AuthStrategy> = {}): AuthStrategy {
  return {
    mode: 'dev',
    restore: jest.fn(async () => null),
    signIn: jest.fn(async () => ({ suggestedProfile: null })),
    signOut: jest.fn(async () => undefined),
    getAuthHeaders: jest.fn(async () => ({ 'X-Dev-User': 'ada' })),
    ...overrides,
  };
}

const states = (controller: ReturnType<typeof createAuthController>) => {
  const seen: string[] = [];
  controller.subscribe(() => seen.push(controller.getState().status));
  return seen;
};

describe('createAuthController', () => {
  it('starts out restoring, then settles on what the strategy found', async () => {
    const signedOutController = createAuthController(strategyDouble());
    expect(signedOutController.getState().status).toBe('restoring');
    await signedOutController.restore();
    expect(signedOutController.getState()).toEqual({
      status: 'signedOut',
      suggestedProfile: null,
      expired: false,
    });

    const profile = { displayName: 'Ada', email: 'ada@example.test' };
    const resumed = createAuthController(
      strategyDouble({ restore: jest.fn(async () => ({ suggestedProfile: profile })) }),
    );
    await resumed.restore();
    expect(resumed.getState()).toEqual({
      status: 'signedIn',
      suggestedProfile: profile,
      expired: false,
    });
  });

  it('restores once however often it is asked, as React may run an effect twice', async () => {
    const strategy = strategyDouble();
    const controller = createAuthController(strategy);

    await Promise.all([controller.restore(), controller.restore()]);
    await controller.restore();

    expect(strategy.restore).toHaveBeenCalledTimes(1);
  });

  it('treats a stored session it cannot read as being signed out', async () => {
    const controller = createAuthController(
      strategyDouble({ restore: jest.fn().mockRejectedValue(new Error('Keychain unavailable')) }),
    );

    await controller.restore();

    expect(controller.getState().status).toBe('signedOut');
  });

  it('signs in and tells subscribers', async () => {
    const controller = createAuthController(strategyDouble());
    await controller.restore();
    const seen = states(controller);

    await controller.signIn({ devUser: 'ada' });

    expect(controller.getState().status).toBe('signedIn');
    expect(seen).toEqual(['signedIn']);
  });

  it('stays signed out when the person backs out of the sign-in', async () => {
    const controller = createAuthController(strategyDouble({ signIn: jest.fn(async () => null) }));
    await controller.restore();

    await controller.signIn();

    expect(controller.getState().status).toBe('signedOut');
  });

  it('passes a failed sign-in on to the screen and stays signed out', async () => {
    const controller = createAuthController(
      strategyDouble({ signIn: jest.fn().mockRejectedValue(new AuthError('Blocked.')) }),
    );
    await controller.restore();

    await expect(controller.signIn()).rejects.toThrow('Blocked.');

    expect(controller.getState().status).toBe('signedOut');
  });

  it('runs one sign-in at a time, and allows another afterwards', async () => {
    const strategy = strategyDouble();
    const controller = createAuthController(strategy);
    await controller.restore();

    await Promise.all([controller.signIn(), controller.signIn()]);
    await controller.signIn();

    expect(strategy.signIn).toHaveBeenCalledTimes(2);
  });

  it('signs out even when the strategy cannot clean up', async () => {
    const controller = createAuthController(
      strategyDouble({ signOut: jest.fn().mockRejectedValue(new Error('Keychain unavailable')) }),
    );
    await controller.restore();
    await controller.signIn();

    await expect(controller.signOut()).rejects.toThrow('Keychain unavailable');

    expect(controller.getState().status).toBe('signedOut');
  });

  it('records that a session expired, and clears the flag on the next sign-in', async () => {
    const strategy = strategyDouble();
    const controller = createAuthController(strategy);
    await controller.restore();
    await controller.signIn();

    controller.expire();
    controller.expire();

    expect(controller.getState()).toMatchObject({ status: 'signedOut', expired: true });
    expect(strategy.signOut).toHaveBeenCalledTimes(1);

    await controller.signIn();
    expect(controller.getState()).toMatchObject({ status: 'signedIn', expired: false });
  });

  it('does not report an expiry for a person who was not signed in', async () => {
    const controller = createAuthController(strategyDouble());
    await controller.restore();

    controller.expire();

    expect(controller.getState().expired).toBe(false);
  });

  it('stops telling a subscriber that unsubscribed', async () => {
    const controller = createAuthController(strategyDouble());
    const listener = jest.fn();
    const unsubscribe = controller.subscribe(listener);
    unsubscribe();

    await controller.restore();

    expect(listener).not.toHaveBeenCalled();
  });

  it('gives the API client the same hooks for its whole life', async () => {
    const strategy = strategyDouble({ refreshCredentials: jest.fn(async () => true) });
    const controller = createAuthController(strategy);

    expect(controller.hooks).toBe(controller.hooks);
    expect(await controller.hooks.getAuthHeaders()).toEqual({ 'X-Dev-User': 'ada' });
    expect(await controller.hooks.refreshCredentials?.()).toBe(true);
    expect(createAuthController(strategyDouble()).hooks.refreshCredentials).toBeUndefined();
  });
});

describe('createAuthStrategy', () => {
  const base: AppConfig = {
    apiMode: 'live',
    apiBaseUrl: 'http://localhost:5196',
    authMode: 'dev',
    oidc: null,
    mockScenario: 'happy',
  };

  it('signs in the way the build was configured', () => {
    const store = createMemoryStore();
    expect(createAuthStrategy(base, store).mode).toBe('dev');
    expect(createAuthStrategy({ ...base, apiMode: 'mock', authMode: 'mock' }, store).mode).toBe(
      'mock',
    );
    expect(
      createAuthStrategy(
        {
          ...base,
          authMode: 'oidc',
          oidc: { authority: 'https://login.example.test', clientId: 'c', scopes: ['openid'] },
        },
        store,
      ).mode,
    ).toBe('oidc');
  });

  it('refuses OIDC sign-in without its settings', () => {
    expect(() => createAuthStrategy({ ...base, authMode: 'oidc' }, createMemoryStore())).toThrow(
      /authority and client id/,
    );
  });
});

describe('mock sign-in', () => {
  it('identifies the demo user only while signed in', async () => {
    const onSignOut = jest.fn();
    const strategy = createMockStrategy({ onSignOut });
    expect(await strategy.restore()).toBeNull();
    expect(await strategy.getAuthHeaders()).toEqual({});

    const info = await strategy.signIn();
    expect(info?.suggestedProfile?.displayName).toBe('Demo investor');
    expect(await strategy.getAuthHeaders()).toEqual({ Authorization: 'Bearer demo-session' });

    await strategy.signOut();
    expect(await strategy.getAuthHeaders()).toEqual({});
    expect(onSignOut).toHaveBeenCalledTimes(1);
  });
});

describe('createAppServices', () => {
  const config: AppConfig = {
    apiMode: 'live',
    apiBaseUrl: 'http://localhost:5196',
    authMode: 'dev',
    oidc: null,
    mockScenario: 'happy',
  };

  it('ends the session and empties the cache when the API refuses the credentials for good', async () => {
    const { auth, queryClient } = createAppServices(config, createMemoryStore());
    await auth.restore();
    await auth.signIn({ devUser: 'ada' });
    queryClient.setQueryData(['portfolio'], { totalValue: 100 });

    await queryClient
      .fetchQuery({
        queryKey: ['me'],
        queryFn: () =>
          Promise.reject(new ApiError({ kind: 'problem', status: 401, title: 'Unauthorized' })),
        retry: false,
        // The session ends inside this query's own error handler, after which it would still schedule a 5 minute gc.
        gcTime: 0,
      })
      .catch(() => undefined);

    expect(auth.getState()).toMatchObject({ status: 'signedOut', expired: true });
    expect(queryClient.getQueryData(['portfolio'])).toBeUndefined();
  });

  it('empties the cache on sign-out, so the next person never sees the last one’s data', async () => {
    const { auth, queryClient } = createAppServices(config, createMemoryStore());
    await auth.restore();
    await auth.signIn({ devUser: 'ada' });
    queryClient.setQueryData(['portfolio'], { totalValue: 100 });

    await auth.signOut();

    expect(queryClient.getQueryData(['portfolio'])).toBeUndefined();
  });

  it('builds a query client that reports unauthorised errors', () => {
    const onUnauthorized = jest.fn();
    expect(createQueryClient({ onUnauthorized })).toBeDefined();
  });
});

it('keeps the dev strategy usable through a controller', async () => {
  const controller = createAuthController(createDevStrategy(createMemoryStore()));
  await controller.restore();
  await controller.signIn({ devUser: 'ada' });
  expect(await controller.hooks.getAuthHeaders()).toEqual({ 'X-Dev-User': 'ada' });
});
