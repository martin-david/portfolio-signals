import type { AuthHooks } from '@/api/createApiClient';
import type { AuthMode } from '@/config/env';

/** What the identity provider told us about the person; offered as the starting point of their profile. */
export interface SuggestedProfile {
  displayName: string;
  email: string;
}

export interface SessionInfo {
  suggestedProfile: SuggestedProfile | null;
}

export interface SignInInput {
  /** Development sign-in only: the name the backend is told in X-Dev-User. */
  devUser?: string;
}

/** One way of proving who the user is. The API client only ever sees the AuthHooks half. */
export interface AuthStrategy extends AuthHooks {
  readonly mode: AuthMode;
  /** The session that survived a restart, if there is one. */
  restore(): Promise<SessionInfo | null>;
  /** Resolves null when the person closed the sign-in without finishing it. Throws AuthError when it failed. */
  signIn(input?: SignInInput): Promise<SessionInfo | null>;
  signOut(): Promise<void>;
}

/** A sign-in that failed for a reason the person can be told about. */
export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
  }
}
