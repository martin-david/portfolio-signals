import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export interface Preferences {
  /** Hide the user's own money amounts (percentages and market prices stay visible). */
  hideAmounts: boolean;
}

export const DEFAULT_PREFERENCES: Preferences = { hideAmounts: false };

export const PREFERENCES_KEY = 'portfolio-signals.preferences.v1';

/** Reads stored preferences defensively: anything unexpected falls back to the defaults. */
export function parsePreferences(raw: string | null | undefined): Preferences {
  if (!raw) {
    return DEFAULT_PREFERENCES;
  }
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value === 'object' && value !== null) {
      const hideAmounts = (value as Record<string, unknown>).hideAmounts;
      return {
        hideAmounts:
          typeof hideAmounts === 'boolean' ? hideAmounts : DEFAULT_PREFERENCES.hideAmounts,
      };
    }
  } catch {
    // Corrupt storage is not worth failing for.
  }
  return DEFAULT_PREFERENCES;
}

interface PreferencesContextValue {
  preferences: Preferences;
  /** False until the stored preferences have been read. */
  ready: boolean;
  setHideAmounts: (hide: boolean) => void;
  toggleHideAmounts: () => void;
}

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState<Preferences>(DEFAULT_PREFERENCES);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(PREFERENCES_KEY)
      .then((raw) => {
        if (active) {
          setPreferences(parsePreferences(raw));
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) {
          setReady(true);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const update = useCallback((next: Preferences) => {
    setPreferences(next);
    AsyncStorage.setItem(PREFERENCES_KEY, JSON.stringify(next)).catch(() => undefined);
  }, []);

  const value = useMemo<PreferencesContextValue>(
    () => ({
      preferences,
      ready,
      setHideAmounts: (hide) => update({ ...preferences, hideAmounts: hide }),
      toggleHideAmounts: () => update({ ...preferences, hideAmounts: !preferences.hideAmounts }),
    }),
    [preferences, ready, update],
  );

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences(): PreferencesContextValue {
  const value = useContext(PreferencesContext);
  if (!value) {
    throw new Error('usePreferences must be used inside PreferencesProvider.');
  }
  return value;
}
