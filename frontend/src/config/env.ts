export type ApiMode = 'live' | 'mock';
export type AuthMode = 'oidc' | 'dev' | 'mock';

export const MOCK_SCENARIOS = [
  'happy',
  'empty',
  'rate-limited',
  'credentials-rejected',
  'failing',
] as const;
export type MockScenario = (typeof MOCK_SCENARIOS)[number];

export interface OidcConfig {
  authority: string;
  clientId: string;
  scopes: string[];
}

export interface AppConfig {
  apiMode: ApiMode;
  apiBaseUrl: string;
  authMode: AuthMode;
  oidc: OidcConfig | null;
  mockScenario: MockScenario;
}

export interface RawEnv {
  EXPO_PUBLIC_API_MODE?: string;
  EXPO_PUBLIC_API_BASE_URL?: string;
  EXPO_PUBLIC_AUTH_MODE?: string;
  EXPO_PUBLIC_OIDC_AUTHORITY?: string;
  EXPO_PUBLIC_OIDC_CLIENT_ID?: string;
  EXPO_PUBLIC_OIDC_SCOPES?: string;
  EXPO_PUBLIC_MOCK_SCENARIO?: string;
}

export type ConfigResult = { ok: true; config: AppConfig } | { ok: false; errors: string[] };

export const DEFAULT_API_BASE_URL = 'http://localhost:5196';
export const DEFAULT_OIDC_SCOPES = ['openid', 'profile', 'email', 'offline_access'];

// Reserved top-level domain (RFC 2606): the mock API never touches the network, it only needs an absolute URL.
const MOCK_BASE_URL = 'https://mock.invalid';

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '10.0.2.2']);

function clean(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function parseHttpUrl(value: string): { protocol: 'http' | 'https'; host: string } | null {
  const match = /^(https?):\/\/(\[[^\]]+\]|[^/\s:?#@]+)(?::\d{1,5})?(?:[/?#]\S*)?$/i.exec(value);
  if (!match) {
    return null;
  }
  return { protocol: match[1].toLowerCase() as 'http' | 'https', host: match[2].toLowerCase() };
}

function stripTrailingSlashes(value: string): string {
  return value.replace(/\/+$/, '');
}

function parseOptions<T extends string>(
  name: string,
  value: string | undefined,
  allowed: readonly T[],
  errors: string[],
): T | undefined {
  if (value === undefined) {
    return undefined;
  }
  const normalised = value.toLowerCase();
  const found = allowed.find((option) => option === normalised);
  if (!found) {
    errors.push(`${name} must be one of: ${allowed.join(', ')} (got "${value}").`);
  }
  return found;
}

function checkUrl(
  name: string,
  value: string,
  options: { isDev: boolean },
  errors: string[],
): string | undefined {
  const parsed = parseHttpUrl(value);
  if (!parsed) {
    errors.push(`${name} must be an absolute http(s) URL (got "${value}").`);
    return undefined;
  }
  if (parsed.protocol !== 'https' && !options.isDev && !LOOPBACK_HOSTS.has(parsed.host)) {
    errors.push(`${name} must use https in production builds (got "${value}").`);
    return undefined;
  }
  return stripTrailingSlashes(value);
}

/**
 * Validates the EXPO_PUBLIC_* settings. The rules protect the people running a build: dev sign-in and plain-http
 * backends are for development builds only, and a mock API cannot be combined with real sign-in.
 */
export function parseConfig(raw: RawEnv, options: { isDev: boolean }): ConfigResult {
  const errors: string[] = [];

  const apiMode =
    parseOptions(
      'EXPO_PUBLIC_API_MODE',
      clean(raw.EXPO_PUBLIC_API_MODE),
      ['live', 'mock'],
      errors,
    ) ?? 'live';
  const requestedAuth = parseOptions(
    'EXPO_PUBLIC_AUTH_MODE',
    clean(raw.EXPO_PUBLIC_AUTH_MODE),
    ['oidc', 'dev', 'mock'],
    errors,
  );
  const mockScenario =
    parseOptions(
      'EXPO_PUBLIC_MOCK_SCENARIO',
      clean(raw.EXPO_PUBLIC_MOCK_SCENARIO),
      MOCK_SCENARIOS,
      errors,
    ) ?? 'happy';

  if (apiMode === 'mock') {
    if (errors.length > 0) {
      return { ok: false, errors };
    }
    return {
      ok: true,
      config: {
        apiMode,
        apiBaseUrl: MOCK_BASE_URL,
        authMode: 'mock',
        oidc: null,
        mockScenario,
      },
    };
  }

  const baseUrlSetting = clean(raw.EXPO_PUBLIC_API_BASE_URL);
  let apiBaseUrl = '';
  if (baseUrlSetting) {
    apiBaseUrl = checkUrl('EXPO_PUBLIC_API_BASE_URL', baseUrlSetting, options, errors) ?? '';
  } else if (options.isDev) {
    apiBaseUrl = DEFAULT_API_BASE_URL;
  } else {
    errors.push('EXPO_PUBLIC_API_BASE_URL is required in production builds.');
  }

  const authMode = requestedAuth ?? (options.isDev ? 'dev' : 'oidc');
  if (authMode === 'mock') {
    errors.push('EXPO_PUBLIC_AUTH_MODE=mock needs EXPO_PUBLIC_API_MODE=mock.');
  }
  if (authMode === 'dev' && !options.isDev) {
    errors.push('EXPO_PUBLIC_AUTH_MODE=dev is only available in development builds.');
  }

  let oidc: OidcConfig | null = null;
  if (authMode === 'oidc') {
    const authoritySetting = clean(raw.EXPO_PUBLIC_OIDC_AUTHORITY);
    const clientId = clean(raw.EXPO_PUBLIC_OIDC_CLIENT_ID);
    let authority: string | undefined;
    if (!authoritySetting) {
      errors.push('EXPO_PUBLIC_OIDC_AUTHORITY is required when EXPO_PUBLIC_AUTH_MODE=oidc.');
    } else {
      authority = checkUrl('EXPO_PUBLIC_OIDC_AUTHORITY', authoritySetting, options, errors);
    }
    if (!clientId) {
      errors.push('EXPO_PUBLIC_OIDC_CLIENT_ID is required when EXPO_PUBLIC_AUTH_MODE=oidc.');
    }
    const scopes = (clean(raw.EXPO_PUBLIC_OIDC_SCOPES) ?? '').split(/[\s,]+/).filter(Boolean);
    if (authority && clientId) {
      oidc = {
        authority,
        clientId,
        scopes: scopes.length > 0 ? scopes : [...DEFAULT_OIDC_SCOPES],
      };
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }
  return { ok: true, config: { apiMode, apiBaseUrl, authMode, oidc, mockScenario } };
}

export function readEnv(): RawEnv {
  // Expo only inlines EXPO_PUBLIC_* variables that are read as process.env.NAME, so every one is spelled out.
  return {
    EXPO_PUBLIC_API_MODE: process.env.EXPO_PUBLIC_API_MODE,
    EXPO_PUBLIC_API_BASE_URL: process.env.EXPO_PUBLIC_API_BASE_URL,
    EXPO_PUBLIC_AUTH_MODE: process.env.EXPO_PUBLIC_AUTH_MODE,
    EXPO_PUBLIC_OIDC_AUTHORITY: process.env.EXPO_PUBLIC_OIDC_AUTHORITY,
    EXPO_PUBLIC_OIDC_CLIENT_ID: process.env.EXPO_PUBLIC_OIDC_CLIENT_ID,
    EXPO_PUBLIC_OIDC_SCOPES: process.env.EXPO_PUBLIC_OIDC_SCOPES,
    EXPO_PUBLIC_MOCK_SCENARIO: process.env.EXPO_PUBLIC_MOCK_SCENARIO,
  };
}

let cached: ConfigResult | undefined;

/** The configuration of this build, validated once. */
export function loadConfig(): ConfigResult {
  cached ??= parseConfig(readEnv(), { isDev: __DEV__ });
  return cached;
}
