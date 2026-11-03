import { DEFAULT_API_BASE_URL, DEFAULT_OIDC_SCOPES, parseConfig, type ConfigResult } from './env';

const dev = { isDev: true };
const prod = { isDev: false };

function config(result: ConfigResult) {
  if (!result.ok) {
    throw new Error(`Expected a valid configuration, got: ${result.errors.join(' | ')}`);
  }
  return result.config;
}

function errors(result: ConfigResult) {
  if (result.ok) {
    throw new Error('Expected configuration errors');
  }
  return result.errors;
}

describe('parseConfig', () => {
  it('runs against the local API with dev sign-in by default in development', () => {
    expect(config(parseConfig({}, dev))).toEqual({
      apiMode: 'live',
      apiBaseUrl: DEFAULT_API_BASE_URL,
      authMode: 'dev',
      oidc: null,
      mockScenario: 'happy',
    });
  });

  it('serves the offline demo with mock sign-in whatever else is set', () => {
    const result = config(
      parseConfig(
        {
          EXPO_PUBLIC_API_MODE: 'mock',
          EXPO_PUBLIC_AUTH_MODE: 'oidc',
          EXPO_PUBLIC_API_BASE_URL: 'https://api.example.com',
          EXPO_PUBLIC_MOCK_SCENARIO: 'rate-limited',
        },
        prod,
      ),
    );
    expect(result.apiMode).toBe('mock');
    expect(result.authMode).toBe('mock');
    expect(result.mockScenario).toBe('rate-limited');
    expect(result.oidc).toBeNull();
  });

  it('requires an https backend and OIDC settings in production builds', () => {
    expect(errors(parseConfig({}, prod))).toEqual([
      'EXPO_PUBLIC_API_BASE_URL is required in production builds.',
      'EXPO_PUBLIC_OIDC_AUTHORITY is required when EXPO_PUBLIC_AUTH_MODE=oidc.',
      'EXPO_PUBLIC_OIDC_CLIENT_ID is required when EXPO_PUBLIC_AUTH_MODE=oidc.',
    ]);
  });

  it('refuses dev sign-in and plain http outside development', () => {
    const result = errors(
      parseConfig(
        {
          EXPO_PUBLIC_API_BASE_URL: 'http://api.example.com',
          EXPO_PUBLIC_AUTH_MODE: 'dev',
        },
        prod,
      ),
    );
    expect(result).toContain('EXPO_PUBLIC_AUTH_MODE=dev is only available in development builds.');
    expect(result.some((message) => message.includes('must use https in production builds'))).toBe(
      true,
    );
  });

  it('allows a loopback http backend for a production build tested on the same machine', () => {
    const result = config(
      parseConfig(
        {
          EXPO_PUBLIC_API_BASE_URL: 'http://localhost:5196',
          EXPO_PUBLIC_OIDC_AUTHORITY: 'https://login.example.com/tenant/v2.0',
          EXPO_PUBLIC_OIDC_CLIENT_ID: 'client-1',
        },
        prod,
      ),
    );
    expect(result.apiBaseUrl).toBe('http://localhost:5196');
  });

  it('rejects the mock sign-in against a real backend', () => {
    expect(errors(parseConfig({ EXPO_PUBLIC_AUTH_MODE: 'mock' }, dev))).toEqual([
      'EXPO_PUBLIC_AUTH_MODE=mock needs EXPO_PUBLIC_API_MODE=mock.',
    ]);
  });

  it('strips trailing slashes from URLs', () => {
    const result = config(
      parseConfig(
        {
          EXPO_PUBLIC_API_BASE_URL: 'https://api.example.com/',
          EXPO_PUBLIC_AUTH_MODE: 'oidc',
          EXPO_PUBLIC_OIDC_AUTHORITY: 'https://login.example.com/tenant/v2.0//',
          EXPO_PUBLIC_OIDC_CLIENT_ID: 'client-1',
        },
        prod,
      ),
    );
    expect(result.apiBaseUrl).toBe('https://api.example.com');
    expect(result.oidc?.authority).toBe('https://login.example.com/tenant/v2.0');
  });

  it('reads scopes separated by spaces or commas and falls back to the defaults', () => {
    const base = {
      EXPO_PUBLIC_AUTH_MODE: 'oidc',
      EXPO_PUBLIC_OIDC_AUTHORITY: 'https://login.example.com',
      EXPO_PUBLIC_OIDC_CLIENT_ID: 'client-1',
    };
    expect(
      config(
        parseConfig({ ...base, EXPO_PUBLIC_OIDC_SCOPES: 'openid, api://x/access  email' }, dev),
      ).oidc?.scopes,
    ).toEqual(['openid', 'api://x/access', 'email']);
    expect(config(parseConfig(base, dev)).oidc?.scopes).toEqual(DEFAULT_OIDC_SCOPES);
  });

  it('names every invalid setting', () => {
    const result = errors(
      parseConfig(
        {
          EXPO_PUBLIC_API_MODE: 'fake',
          EXPO_PUBLIC_AUTH_MODE: 'password',
          EXPO_PUBLIC_MOCK_SCENARIO: 'sunny',
          EXPO_PUBLIC_API_BASE_URL: 'not a url',
        },
        dev,
      ),
    );
    expect(result).toEqual(
      expect.arrayContaining([
        expect.stringContaining('EXPO_PUBLIC_API_MODE must be one of: live, mock'),
        expect.stringContaining('EXPO_PUBLIC_AUTH_MODE must be one of: oidc, dev, mock'),
        expect.stringContaining('EXPO_PUBLIC_MOCK_SCENARIO must be one of: happy'),
      ]),
    );
  });

  it('rejects a base URL that is not an absolute http(s) URL', () => {
    expect(errors(parseConfig({ EXPO_PUBLIC_API_BASE_URL: 'api.example.com' }, dev))).toEqual([
      'EXPO_PUBLIC_API_BASE_URL must be an absolute http(s) URL (got "api.example.com").',
    ]);
  });
});
