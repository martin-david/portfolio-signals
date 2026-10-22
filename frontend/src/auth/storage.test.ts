import { SESSION_KEYS, createSessionStore } from './sessionStore';
import { createBrowserSessionStore, createMemoryStore } from './storage';

describe('createMemoryStore', () => {
  it('stores, replaces and removes values', async () => {
    const store = createMemoryStore();
    expect(await store.get('a')).toBeNull();
    await store.set('a', '1');
    await store.set('a', '2');
    expect(await store.get('a')).toBe('2');
    await store.remove('a');
    expect(await store.get('a')).toBeNull();
  });
});

describe('createBrowserSessionStore', () => {
  it('uses the storage it is given', async () => {
    const backing = new Map<string, string>();
    const store = createBrowserSessionStore({
      getItem: (key) => backing.get(key) ?? null,
      setItem: (key, value) => void backing.set(key, value),
      removeItem: (key) => void backing.delete(key),
    });

    await store.set('k', 'v');

    expect(backing.get('k')).toBe('v');
    expect(await store.get('k')).toBe('v');
    await store.remove('k');
    expect(backing.has('k')).toBe(false);
  });

  it('keeps working in memory when the browser refuses to store', async () => {
    const blocked = () => {
      throw new Error('The quota has been exceeded.');
    };
    const store = createBrowserSessionStore({
      getItem: blocked,
      setItem: blocked,
      removeItem: blocked,
    });

    await store.set('k', 'v');

    expect(await store.get('k')).toBe('v');
    await store.remove('k');
    expect(await store.get('k')).toBeNull();
  });

  it('works in memory when there is no storage at all', async () => {
    const store = createBrowserSessionStore(undefined);
    await store.set('k', 'v');
    expect(await store.get('k')).toBe('v');
  });
});

describe('createSessionStore', () => {
  const session = {
    accessToken: 'access-1',
    refreshToken: 'refresh-1',
    expiresAt: 1_900_000_000_000,
    suggestedProfile: { displayName: 'Ada Byron', email: 'ada@example.test' },
  };

  it('keeps each secret in an entry of its own and gives it all back', async () => {
    const raw = createMemoryStore();
    const store = createSessionStore(raw);

    await store.save(session);

    expect(await raw.get(SESSION_KEYS.access)).toBe('access-1');
    expect(await raw.get(SESSION_KEYS.refresh)).toBe('refresh-1');
    expect(await raw.get(SESSION_KEYS.meta)).not.toContain('access-1');
    expect(await store.load()).toEqual(session);
  });

  it('forgets a refresh token that the provider stopped issuing', async () => {
    const raw = createMemoryStore();
    const store = createSessionStore(raw);
    await store.save(session);

    await store.save({ ...session, refreshToken: null });

    expect((await store.load())?.refreshToken).toBeNull();
  });

  it('has nothing to load before a sign-in and after clearing', async () => {
    const store = createSessionStore(createMemoryStore());
    expect(await store.load()).toBeNull();
    await store.save(session);
    await store.clear();
    expect(await store.load()).toBeNull();
  });

  it('survives damaged metadata by dropping only the metadata', async () => {
    const raw = createMemoryStore();
    const store = createSessionStore(raw);
    await store.save(session);
    await raw.set(SESSION_KEYS.meta, '{not json');

    expect(await store.load()).toEqual({
      accessToken: 'access-1',
      refreshToken: 'refresh-1',
      expiresAt: null,
      suggestedProfile: null,
    });

    await raw.set(
      SESSION_KEYS.meta,
      JSON.stringify({ expiresAt: 'soon', suggestedProfile: { email: 1 } }),
    );
    expect(await store.load()).toMatchObject({ expiresAt: null, suggestedProfile: null });
  });
});
