import { DEV_USER_HEADER, DEV_USER_KEY, checkDevUser, createDevStrategy } from './devStrategy';
import { createMemoryStore } from './storage';
import { AuthError } from './types';

describe('checkDevUser', () => {
  it.each(['demo', 'a', 'Ada.Byron-1_x', 'x'.repeat(64)])('accepts %s', (name) => {
    expect(checkDevUser(name)).toBeNull();
  });

  it.each(['', '   ', 'two words', 'ünïcode', 'a@b', 'x'.repeat(65), 'line\nbreak'])(
    'rejects %j, which could not be sent as a header value',
    (name) => {
      expect(checkDevUser(name)).toMatch(/^Use 1 to 64/);
    },
  );
});

describe('createDevStrategy', () => {
  it('signs in as the named user and identifies them with the dev header', async () => {
    const store = createMemoryStore();
    const strategy = createDevStrategy(store);
    expect(await strategy.getAuthHeaders()).toEqual({});

    const info = await strategy.signIn({ devUser: ' ada ' });

    expect(info).toEqual({
      suggestedProfile: { displayName: 'ada', email: 'ada@example.test' },
    });
    expect(await strategy.getAuthHeaders()).toEqual({ [DEV_USER_HEADER]: 'ada' });
    expect(await store.get(DEV_USER_KEY)).toBe('ada');
  });

  it('refuses a name that cannot be a header value', async () => {
    const strategy = createDevStrategy(createMemoryStore());

    await expect(strategy.signIn({ devUser: 'two words' })).rejects.toBeInstanceOf(AuthError);
    await expect(strategy.signIn()).rejects.toBeInstanceOf(AuthError);
    expect(await strategy.getAuthHeaders()).toEqual({});
  });

  it('picks the session up again after a restart', async () => {
    const store = createMemoryStore();
    await createDevStrategy(store).signIn({ devUser: 'ada' });

    const restarted = createDevStrategy(store);
    const info = await restarted.restore();

    expect(info?.suggestedProfile?.displayName).toBe('ada');
    expect(await restarted.getAuthHeaders()).toEqual({ [DEV_USER_HEADER]: 'ada' });
  });

  it('ignores a stored name that is no longer acceptable', async () => {
    const store = createMemoryStore();
    await store.set(DEV_USER_KEY, 'not valid');

    expect(await createDevStrategy(store).restore()).toBeNull();
  });

  it('forgets the user on sign-out', async () => {
    const store = createMemoryStore();
    const strategy = createDevStrategy(store);
    await strategy.signIn({ devUser: 'ada' });

    await strategy.signOut();

    expect(await strategy.getAuthHeaders()).toEqual({});
    expect(await store.get(DEV_USER_KEY)).toBeNull();
    expect(await createDevStrategy(store).restore()).toBeNull();
  });

  it('has no credentials to refresh', () => {
    expect(createDevStrategy(createMemoryStore()).refreshCredentials).toBeUndefined();
  });
});
