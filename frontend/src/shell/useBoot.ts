import { useAuth } from '@/auth';
import { useMe } from '@/features/profile/hooks';
import { usePreferences } from '@/lib/preferences';

import { bootPhase, type BootPhase } from './bootPhase';

export interface Boot {
  phase: BootPhase;
  /** Why the account could not be opened, when phase is account-error. */
  error: unknown;
  retry: () => void;
}

/** Combines the session, the stored preferences and the profile into the phase the app is in. */
export function useBoot(fontsReady: boolean): Boot {
  const { status } = useAuth();
  const { ready: preferencesReady } = usePreferences();
  const me = useMe({ enabled: status === 'signedIn' });
  return {
    phase: bootPhase({
      fontsReady,
      preferencesReady,
      authStatus: status,
      profile: { data: me.data, isError: me.isError, isFetching: me.isFetching },
    }),
    error: me.error,
    retry: () => void me.refetch(),
  };
}
