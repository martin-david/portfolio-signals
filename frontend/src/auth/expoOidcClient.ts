import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import type { OidcConfig } from '@/config/env';

import type { AuthorizeResult, OidcClient, RefreshResult, TokenSet } from './oidcStrategy';

if (Platform.OS === 'web') {
  // On web the sign-in runs in a popup that lands back on this app. This lets the popup hand its result to the
  // window that opened it and close itself.
  WebBrowser.maybeCompleteAuthSession();
}

/** The URL scheme registered in app.json; the identity provider must allow `portfoliosignals://auth/callback`. */
export const APP_SCHEME = 'portfoliosignals';
export const REDIRECT_PATH = 'auth/callback';

const REJECTED_CODES = new Set(['invalid_grant', 'invalid_client', 'unauthorized_client']);

function toTokenSet(response: AuthSession.TokenResponse): TokenSet {
  return {
    accessToken: response.accessToken,
    refreshToken: response.refreshToken ?? null,
    idToken: response.idToken ?? null,
    expiresAt:
      response.expiresIn === undefined ? null : (response.issuedAt + response.expiresIn) * 1000,
  };
}

/** OpenID Connect through expo-auth-session: discovery, PKCE, the browser round trip and the token endpoint. */
export function createExpoOidcClient(): OidcClient {
  const discoveries = new Map<string, Promise<AuthSession.DiscoveryDocument>>();

  function discover(authority: string) {
    let found = discoveries.get(authority);
    if (!found) {
      found = AuthSession.fetchDiscoveryAsync(authority);
      discoveries.set(authority, found);
      found.catch(() => discoveries.delete(authority));
    }
    return found;
  }

  return {
    async authorize(config: OidcConfig): Promise<AuthorizeResult> {
      const discovery = await discover(config.authority);
      const redirectUri = AuthSession.makeRedirectUri({ scheme: APP_SCHEME, path: REDIRECT_PATH });
      const request = new AuthSession.AuthRequest({
        clientId: config.clientId,
        scopes: config.scopes,
        redirectUri,
        responseType: AuthSession.ResponseType.Code,
        usePKCE: true,
      });
      const result = await request.promptAsync(discovery);
      if (result.type === 'error') {
        return {
          type: 'error',
          message:
            result.error?.description ??
            result.error?.message ??
            'The identity provider reported an error.',
        };
      }
      if (result.type !== 'success') {
        return { type: 'cancel' };
      }
      const response = await AuthSession.exchangeCodeAsync(
        {
          clientId: config.clientId,
          code: result.params.code,
          redirectUri,
          extraParams: { code_verifier: request.codeVerifier ?? '' },
        },
        discovery,
      );
      return { type: 'success', tokens: toTokenSet(response) };
    },

    async refresh(config: OidcConfig, refreshToken: string): Promise<RefreshResult> {
      try {
        const response = await AuthSession.refreshAsync(
          { clientId: config.clientId, refreshToken },
          await discover(config.authority),
        );
        return { type: 'success', tokens: toTokenSet(response) };
      } catch (error) {
        if (error instanceof AuthSession.TokenError && REJECTED_CODES.has(error.code)) {
          return { type: 'rejected' };
        }
        throw error;
      }
    },

    async revoke(config: OidcConfig, refreshToken: string): Promise<void> {
      const discovery = await discover(config.authority);
      if (!discovery.revocationEndpoint) {
        return;
      }
      // RFC 7009 makes the token type hint optional, and the endpoint finds the token without it.
      await AuthSession.revokeAsync({ clientId: config.clientId, token: refreshToken }, discovery);
    },
  };
}
