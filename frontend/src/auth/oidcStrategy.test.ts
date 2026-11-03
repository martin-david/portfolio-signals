import type { OidcConfig } from '@/config/env';
import { makeJwt } from '@/test/jwt';

import {
  EXPIRY_SKEW_MS,
  createOidcStrategy,
  type AuthorizeResult,
  type OidcClient,
  type RefreshResult,
  type TokenSet,
} from './oidcStrategy';
import { createSessionStore, type SessionStore, type StoredSession } from './sessionStore';
import { createMemoryStore } from './storage';
import { AuthError } from './types';

const config: OidcConfig = {
  authority: 'https://login.example.test/tenant/v2.0',
  clientId: 'client-1',
  scopes: ['openid', 'offline_access'],
};

const NOW = 1_800_000_000_000;

function tokens(overrides: Partial<TokenSet> = {}): TokenSet {
  return {
    accessToken: 'access-1',
    refreshToken: 'refresh-1',
    idToken: makeJwt({ name: 'Ada Byron', email: 'ada@example.test' }),
    expiresAt: NOW + 3_600_000,
    ...overrides,
  };
}

interface Fake extends OidcClient {
  authorize: jest.Mock<Promise<AuthorizeResult>, [OidcConfig]>;
  refresh: jest.Mock<Promise<RefreshResult>, [OidcConfig, string]>;
  revoke: jest.Mock<Promise<void>, [OidcConfig, string]>;
}

function fakeClient(): Fake {
  return {
    authorize: jest.fn<Promise<AuthorizeResult>, [OidcConfig]>(async () => ({
      type: 'success',
      tokens: tokens(),
    })),
    refresh: jest.fn<Promise<RefreshResult>, [OidcConfig, string]>(async () => ({
      type: 'success',
      tokens: tokens({ accessToken: 'access-2', refreshToken: 'refresh-2' }),
    })),
    revoke: jest.fn<Promise<void>, [OidcConfig, string]>(async () => undefined),
  };
}

function setup(overrides: { client?: Fake; store?: SessionStore; now?: () => number } = {}) {
  const client = overrides.client ?? fakeClient();
  const store = overrides.store ?? createSessionStore(createMemoryStore());
  const clock = { now: NOW };
  const strategy = createOidcStrategy({
    config,
    store,
    client,
    now: overrides.now ?? (() => clock.now),
  });
  return { strategy, client, store, clock };
}

const stored = (overrides: Partial<StoredSession> = {}): StoredSession => ({
  accessToken: 'access-0',
  refreshToken: 'refresh-0',
  expiresAt: NOW + 3_600_000,
  suggestedProfile: null,
  ...overrides,
});

describe('signIn', () => {
  it('stores the tokens, suggests a profile from the ID token and sends the access token as a bearer', async () => {
    const { strategy, store, client } = setup();

    const info = await strategy.signIn();

    expect(client.authorize).toHaveBeenCalledWith(config);
    expect(info).toEqual({
      suggestedProfile: { displayName: 'Ada Byron', email: 'ada@example.test' },
    });
    expect(await strategy.getAuthHeaders()).toEqual({ Authorization: 'Bearer access-1' });
    expect(await store.load()).toMatchObject({
      accessToken: 'access-1',
      refreshToken: 'refresh-1',
      expiresAt: NOW + 3_600_000,
    });
  });

  it('changes nothing when the person closes the sign-in', async () => {
    const client = fakeClient();
    client.authorize.mockResolvedValue({ type: 'cancel' });
    const { strategy, store } = setup({ client });

    expect(await strategy.signIn()).toBeNull();

    expect(await store.load()).toBeNull();
    expect(await strategy.getAuthHeaders()).toEqual({});
  });

  it("reports the provider's own error message", async () => {
    const client = fakeClient();
    client.authorize.mockResolvedValue({ type: 'error', message: 'The user is blocked.' });

    await expect(setup({ client }).strategy.signIn()).rejects.toThrow('The user is blocked.');
  });

  it('turns a network failure into a message the person can act on', async () => {
    const client = fakeClient();
    client.authorize.mockRejectedValue(new TypeError('Network request failed'));

    const failure = setup({ client }).strategy.signIn();

    await expect(failure).rejects.toBeInstanceOf(AuthError);
    await expect(failure).rejects.toThrow(/could not be reached/);
  });
});

describe('restore', () => {
  it('resumes a stored session', async () => {
    const { strategy, store } = setup();
    await store.save(stored({ suggestedProfile: { displayName: 'Ada', email: 'a@example.test' } }));

    expect(await strategy.restore()).toEqual({
      suggestedProfile: { displayName: 'Ada', email: 'a@example.test' },
    });
    expect(await strategy.getAuthHeaders()).toEqual({ Authorization: 'Bearer access-0' });
  });

  it('has nothing to resume on a first run', async () => {
    expect(await setup().strategy.restore()).toBeNull();
  });

  it('drops an expired session that cannot be renewed', async () => {
    const { strategy, store } = setup();
    await store.save(stored({ refreshToken: null, expiresAt: NOW - 1 }));

    expect(await strategy.restore()).toBeNull();
    expect(await store.load()).toBeNull();
  });

  it('keeps an expired access token that can be renewed', async () => {
    const { strategy, store } = setup();
    await store.save(stored({ expiresAt: NOW - 1 }));

    expect(await strategy.restore()).not.toBeNull();
  });
});

describe('getAuthHeaders', () => {
  it('uses a token that has time left as it is', async () => {
    const { strategy, store, client } = setup();
    await store.save(stored({ expiresAt: NOW + EXPIRY_SKEW_MS + 1000 }));
    await strategy.restore();

    expect(await strategy.getAuthHeaders()).toEqual({ Authorization: 'Bearer access-0' });
    expect(client.refresh).not.toHaveBeenCalled();
  });

  it('renews a token that is about to expire before using it, and keeps the renewed one', async () => {
    const { strategy, store, client } = setup();
    await store.save(stored({ expiresAt: NOW + EXPIRY_SKEW_MS - 1 }));
    await strategy.restore();

    expect(await strategy.getAuthHeaders()).toEqual({ Authorization: 'Bearer access-2' });

    expect(client.refresh).toHaveBeenCalledWith(config, 'refresh-0');
    expect(await store.load()).toMatchObject({
      accessToken: 'access-2',
      refreshToken: 'refresh-2',
    });
  });

  it('shares one renewal between requests that start together', async () => {
    const { strategy, store, client } = setup();
    await store.save(stored({ expiresAt: NOW - 1 }));
    await strategy.restore();

    const headers = await Promise.all([
      strategy.getAuthHeaders(),
      strategy.getAuthHeaders(),
      strategy.refreshCredentials!(),
    ]);

    expect(client.refresh).toHaveBeenCalledTimes(1);
    expect(headers[0]).toEqual({ Authorization: 'Bearer access-2' });
    expect(headers[1]).toEqual({ Authorization: 'Bearer access-2' });
    expect(headers[2]).toBe(true);
  });

  it('renews again later, once the first renewal has finished', async () => {
    const { strategy, store, client } = setup();
    await store.save(stored());
    await strategy.restore();

    await strategy.refreshCredentials!();
    await strategy.refreshCredentials!();

    expect(client.refresh).toHaveBeenCalledTimes(2);
    expect(client.refresh).toHaveBeenLastCalledWith(config, 'refresh-2');
  });

  it('sends nothing when signed out', async () => {
    expect(await setup().strategy.getAuthHeaders()).toEqual({});
  });
});

describe('refreshCredentials', () => {
  it('keeps the old refresh token when the provider does not rotate it', async () => {
    const client = fakeClient();
    client.refresh.mockResolvedValue({
      type: 'success',
      tokens: tokens({ accessToken: 'access-2', refreshToken: null }),
    });
    const { strategy, store } = setup({ client });
    await store.save(stored());
    await strategy.restore();

    expect(await strategy.refreshCredentials!()).toBe(true);

    expect(await store.load()).toMatchObject({
      accessToken: 'access-2',
      refreshToken: 'refresh-0',
    });
  });

  it('ends the session when the provider refuses the refresh token', async () => {
    const client = fakeClient();
    client.refresh.mockResolvedValue({ type: 'rejected' });
    const { strategy, store } = setup({ client });
    await store.save(stored());
    await strategy.restore();

    expect(await strategy.refreshCredentials!()).toBe(false);

    expect(await store.load()).toBeNull();
    expect(await strategy.getAuthHeaders()).toEqual({});
  });

  it('keeps the session when the provider cannot be reached', async () => {
    const client = fakeClient();
    client.refresh.mockRejectedValue(new TypeError('Network request failed'));
    const { strategy, store } = setup({ client });
    await store.save(stored());
    await strategy.restore();

    expect(await strategy.refreshCredentials!()).toBe(false);

    expect(await store.load()).toMatchObject({ refreshToken: 'refresh-0' });
  });

  it('has nothing to try without a refresh token', async () => {
    const { strategy, store, client } = setup();
    await store.save(stored({ refreshToken: null }));
    await strategy.restore();

    expect(await strategy.refreshCredentials!()).toBe(false);
    expect(client.refresh).not.toHaveBeenCalled();
  });
});

describe('signOut', () => {
  it('forgets the session and asks the provider to revoke the refresh token', async () => {
    const { strategy, store, client } = setup();
    await strategy.signIn();

    await strategy.signOut();

    expect(await store.load()).toBeNull();
    expect(await strategy.getAuthHeaders()).toEqual({});
    expect(client.revoke).toHaveBeenCalledWith(config, 'refresh-1');
  });

  it('is not held up by a provider that fails to revoke', async () => {
    const client = fakeClient();
    client.revoke.mockRejectedValue(new Error('offline'));
    const { strategy } = setup({ client });
    await strategy.signIn();

    await expect(strategy.signOut()).resolves.toBeUndefined();
  });

  it('has nothing to revoke without a refresh token', async () => {
    const client = fakeClient();
    client.authorize.mockResolvedValue({ type: 'success', tokens: tokens({ refreshToken: null }) });
    const { strategy } = setup({ client });
    await strategy.signIn();

    await strategy.signOut();

    expect(client.revoke).not.toHaveBeenCalled();
  });
});
