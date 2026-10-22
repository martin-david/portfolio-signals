import type { AuthStatus } from '@/auth';

export type BootPhase =
  'booting' | 'signed-out' | 'opening-account' | 'account-error' | 'needs-profile' | 'ready';

export interface BootInput {
  fontsReady: boolean;
  preferencesReady: boolean;
  authStatus: AuthStatus;
  profile: {
    /** The profile, null when the API does not know this person yet, undefined while it is not known. */
    data: object | null | undefined;
    isError: boolean;
    isFetching: boolean;
  };
}

/**
 * Where the app stands, which decides what is on screen: nothing of the user's until the session is known, the
 * sign-in when there is none, the set-up form for a person the API does not know yet, otherwise the app itself.
 */
export function bootPhase({
  fontsReady,
  preferencesReady,
  authStatus,
  profile,
}: BootInput): BootPhase {
  if (!fontsReady || !preferencesReady || authStatus === 'restoring') {
    return 'booting';
  }
  if (authStatus === 'signedOut') {
    return 'signed-out';
  }
  // A profile already in hand outranks a failed refresh of it.
  if (profile.data === null) {
    return 'needs-profile';
  }
  if (profile.data !== undefined) {
    return 'ready';
  }
  if (profile.isError && !profile.isFetching) {
    return 'account-error';
  }
  return 'opening-account';
}
