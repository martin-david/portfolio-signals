import type { AppConfig } from '@/config/env';

import { createApiClient, type FetchLike } from './createApiClient';
import { ApiError } from './errors';
import { unwrap, unwrapEmpty } from './request';

const config: AppConfig = {
  apiMode: 'live',
  apiBaseUrl: 'https://api.example.com',
  authMode: 'oidc',
  oidc: null,
  mockScenario: 'happy',
};

const profile = {
  id: 'u1',
  email: 'u1@example.com',
  displayName: 'U One',
  plan: 'Free',
  etoroSyncIntervalMinutes: 10080,
  tipRanksSyncIntervalMinutes: 10080,
  allowsManualSync: true,
  registeredAt: '2026-10-01T10:00:00Z',
};

function json(body: unknown, status = 200, contentType = 'application/json'): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': contentType } });
}

function recorder(respond: (request: Request, call: number) => Response | Promise<Response>) {
  const requests: Request[] = [];
  const fetchImpl: FetchLike = async (request) => {
    requests.push(request);
    return respond(request, requests.length);
  };
  return { fetchImpl, requests };
}

/** A network that never answers until the request is aborted, as a real fetch behaves. */
function hangUntilAborted() {
  // The requests are kept: the abort wiring of a Request is weakly held, so one nobody references can be collected.
  const requests: Request[] = [];
  const fetchImpl: FetchLike = (request) => {
    requests.push(request);
    return new Promise((_resolve, reject) => {
      const abort = () => reject(new DOMException('Aborted', 'AbortError'));
      if (request.signal.aborted) {
        abort();
      } else {
        request.signal.addEventListener('abort', abort, { once: true });
      }
    });
  };
  return { fetchImpl, requests };
}

function client(fetchImpl: FetchLike, extra: Partial<Parameters<typeof createApiClient>[0]> = {}) {
  return createApiClient({
    config,
    fetchImpl,
    getAuthHeaders: async () => ({ Authorization: 'Bearer token-1' }),
    ...extra,
  });
}

describe('createApiClient', () => {
  it('calls the typed endpoint with the base URL and the user credentials', async () => {
    const { fetchImpl, requests } = recorder(() => json(profile));

    const result = await unwrap(client(fetchImpl).GET('/api/v1/me'));

    expect(result.displayName).toBe('U One');
    expect(requests).toHaveLength(1);
    expect(requests[0].url).toBe('https://api.example.com/api/v1/me');
    expect(requests[0].method).toBe('GET');
    expect(requests[0].headers.get('authorization')).toBe('Bearer token-1');
    expect(requests[0].headers.get('accept')).toBe('application/json');
  });

  it('can identify the development user instead of sending a token', async () => {
    const { fetchImpl, requests } = recorder(() => json(profile));

    await unwrap(
      client(fetchImpl, { getAuthHeaders: async () => ({ 'X-Dev-User': 'alice' }) }).GET(
        '/api/v1/me',
      ),
    );

    expect(requests[0].headers.get('x-dev-user')).toBe('alice');
    expect(requests[0].headers.get('authorization')).toBeNull();
  });

  it('sends JSON bodies and path parameters', async () => {
    const { fetchImpl, requests } = recorder(() => json({ provider: 'Etoro' }));

    await client(fetchImpl).PUT('/api/v1/integrations/{provider}', {
      params: { path: { provider: 'Etoro' } },
      body: { credentials: { apiKey: 'k', userKey: 'u' } },
    });

    expect(requests[0].url).toBe('https://api.example.com/api/v1/integrations/Etoro');
    expect(requests[0].method).toBe('PUT');
    expect(requests[0].headers.get('content-type')).toContain('application/json');
    expect(await requests[0].json()).toEqual({ credentials: { apiKey: 'k', userKey: 'u' } });
  });

  it('refreshes the credentials once after a 401 and replays the request, body included', async () => {
    let token = 'expired';
    const { fetchImpl, requests } = recorder((request, call) =>
      call === 1 ? json({ title: 'Unauthorized' }, 401) : json(profile),
    );
    const refreshCredentials = jest.fn(async () => {
      token = 'fresh';
      return true;
    });

    const result = await unwrap(
      client(fetchImpl, {
        getAuthHeaders: async () => ({ Authorization: `Bearer ${token}` }),
        refreshCredentials,
      }).PUT('/api/v1/me', { body: { displayName: 'U One', email: 'u1@example.com' } }),
    );

    expect(result.id).toBe('u1');
    expect(refreshCredentials).toHaveBeenCalledTimes(1);
    expect(requests).toHaveLength(2);
    expect(requests[0].headers.get('authorization')).toBe('Bearer expired');
    expect(requests[1].headers.get('authorization')).toBe('Bearer fresh');
    expect(await requests[1].json()).toEqual({ displayName: 'U One', email: 'u1@example.com' });
  });

  it('gives up with a 401 error when the credentials cannot be refreshed', async () => {
    const { fetchImpl, requests } = recorder(() => json({ title: 'Unauthorized' }, 401));

    await expect(
      unwrap(client(fetchImpl, { refreshCredentials: async () => false }).GET('/api/v1/me')),
    ).rejects.toMatchObject({ status: 401, kind: 'problem' });
    expect(requests).toHaveLength(1);
  });

  it('does not try to refresh when nothing handles refreshing', async () => {
    const { fetchImpl, requests } = recorder(() => json({ title: 'Unauthorized' }, 401));

    await expect(unwrap(client(fetchImpl).GET('/api/v1/me'))).rejects.toMatchObject({
      status: 401,
    });
    expect(requests).toHaveLength(1);
  });

  it('turns a failed network call into a network ApiError', async () => {
    const fetchImpl: FetchLike = async () => {
      throw new TypeError('Failed to fetch');
    };

    const error = await unwrap(client(fetchImpl).GET('/api/v1/me')).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ kind: 'network', status: 0 });
  });

  it('turns a request that takes too long into a network ApiError', async () => {
    const { fetchImpl, requests } = hangUntilAborted();

    const error = await unwrap(client(fetchImpl, { timeoutMs: 20 }).GET('/api/v1/me')).catch(
      (e: unknown) => e,
    );

    expect(error).toMatchObject({ kind: 'network', status: 0 });
    expect(requests).toHaveLength(1);
  });

  it('lets a cancelled request pass through as the abort it is', async () => {
    const controller = new AbortController();
    const { fetchImpl, requests } = hangUntilAborted();

    const pending = unwrap(client(fetchImpl).GET('/api/v1/me', { signal: controller.signal }));
    controller.abort();

    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    expect(requests).toHaveLength(1);
  });
});

describe('unwrap', () => {
  it('throws the problem the backend sent, with its code', async () => {
    const { fetchImpl } = recorder(() =>
      json(
        {
          title: 'The user has not registered a profile yet.',
          status: 404,
          code: 'user.not_registered',
        },
        404,
        'application/problem+json',
      ),
    );

    const error = await unwrap(client(fetchImpl).GET('/api/v1/me')).catch((e: unknown) => e);

    expect(error).toMatchObject({
      kind: 'problem',
      status: 404,
      code: 'user.not_registered',
      message: 'The user has not registered a profile yet.',
    });
  });

  it('keeps the field errors of a validation problem', async () => {
    const { fetchImpl } = recorder(() =>
      json(
        { title: 'One or more validation errors occurred.', errors: { Email: ['Invalid'] } },
        400,
      ),
    );

    const error = await unwrap(
      client(fetchImpl).PUT('/api/v1/me', { body: { displayName: 'x', email: 'nope' } }),
    ).catch((e: unknown) => e);

    expect(error).toMatchObject({ status: 400, fieldErrors: { email: ['Invalid'] } });
  });

  it('copes with an error response that has no JSON body', async () => {
    const { fetchImpl } = recorder(() => new Response('<html>Bad gateway</html>', { status: 502 }));

    const error = await unwrap(client(fetchImpl).GET('/api/v1/me')).catch((e: unknown) => e);

    expect(error).toMatchObject({ kind: 'unexpected', status: 502 });
  });

  it('copes with an empty error response', async () => {
    const { fetchImpl } = recorder(() => new Response(null, { status: 401 }));

    const error = await unwrap(client(fetchImpl).GET('/api/v1/me')).catch((e: unknown) => e);

    expect(error).toMatchObject({ status: 401 });
  });

  it('accepts an empty success response', async () => {
    const { fetchImpl } = recorder(() => new Response(null, { status: 204 }));

    await expect(
      unwrapEmpty(
        client(fetchImpl).DELETE('/api/v1/integrations/{provider}', {
          params: { path: { provider: 'Etoro' } },
        }),
      ),
    ).resolves.toBeUndefined();
  });

  it('reports a failed delete', async () => {
    const { fetchImpl } = recorder(() =>
      json({ title: 'Etoro is not connected.', code: 'integration.not_connected' }, 404),
    );

    await expect(
      unwrapEmpty(
        client(fetchImpl).DELETE('/api/v1/integrations/{provider}', {
          params: { path: { provider: 'Etoro' } },
        }),
      ),
    ).rejects.toMatchObject({ status: 404, code: 'integration.not_connected' });
  });
});
