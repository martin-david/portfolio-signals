import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/** Small string storage that works the same on every platform. */
export interface KeyValueStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

export function createMemoryStore(): KeyValueStore {
  const values = new Map<string, string>();
  return {
    get: async (key) => values.get(key) ?? null,
    set: async (key, value) => {
      values.set(key, value);
    },
    remove: async (key) => {
      values.delete(key);
    },
  };
}

type BrowserStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function browserSessionStorage(): BrowserStorage | undefined {
  try {
    // Reading the property throws when the browser blocks storage.
    return typeof sessionStorage === 'undefined' ? undefined : sessionStorage;
  } catch {
    return undefined;
  }
}

/**
 * Web: per-tab storage. A session survives a reload but not closing the tab, which is the compromise for tokens that
 * JavaScript can read. Falls back to memory when the browser blocks storage.
 */
export function createBrowserSessionStore(
  storage: BrowserStorage | undefined = browserSessionStorage(),
): KeyValueStore {
  const fallback = createMemoryStore();
  if (!storage) {
    return fallback;
  }
  return {
    async get(key) {
      try {
        return storage.getItem(key);
      } catch {
        return fallback.get(key);
      }
    },
    async set(key, value) {
      try {
        storage.setItem(key, value);
      } catch {
        await fallback.set(key, value);
      }
    },
    async remove(key) {
      try {
        storage.removeItem(key);
      } catch {
        await fallback.remove(key);
      }
    },
  };
}

/** Android Keystore and iOS Keychain, through expo-secure-store. Never used on the web, where its module is empty. */
export function createSecureStore(): KeyValueStore {
  const options = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };
  return {
    get: (key) => SecureStore.getItemAsync(key, options),
    set: (key, value) => SecureStore.setItemAsync(key, value, options),
    remove: (key) => SecureStore.deleteItemAsync(key, options),
  };
}

export function createDefaultStore(): KeyValueStore {
  return Platform.OS === 'web' ? createBrowserSessionStore() : createSecureStore();
}
