import {
  ApiError,
  ProblemCode,
  describeError,
  firstFieldError,
  hasProblemCode,
  isRetryable,
  isUnauthorized,
} from './errors';

describe('ApiError.fromResponse', () => {
  it('reads an RFC 9457 problem with the backend code', () => {
    const error = ApiError.fromResponse(404, {
      type: 'https://tools.ietf.org/html/rfc9110#section-15.5.5',
      title: 'No portfolio has been synchronized yet.',
      status: 404,
      code: 'portfolio.not_synced',
    });

    expect(error.kind).toBe('problem');
    expect(error.status).toBe(404);
    expect(error.code).toBe('portfolio.not_synced');
    expect(error.message).toBe('No portfolio has been synchronized yet.');
    expect(hasProblemCode(error, ProblemCode.PortfolioNotSynced)).toBe(true);
    expect(hasProblemCode(error, ProblemCode.UserNotRegistered)).toBe(false);
  });

  it('camel-cases the property names of validation errors', () => {
    const error = ApiError.fromResponse(400, {
      title: 'One or more validation errors occurred.',
      status: 400,
      errors: {
        Email: ["'Email' is not a valid email address."],
        DisplayName: ['Must not be empty.', 'Second message'],
        request: ['A body is required.'],
        Broken: 'not an array',
      },
    });

    expect(error.fieldErrors).toEqual({
      email: ["'Email' is not a valid email address."],
      displayName: ['Must not be empty.', 'Second message'],
      request: ['A body is required.'],
    });
    expect(firstFieldError(error, 'displayName')).toBe('Must not be empty.');
    expect(firstFieldError(error, 'unknown')).toBeUndefined();
    expect(firstFieldError(new Error('x'), 'email')).toBeUndefined();
  });

  it('keeps a useful message when the body is empty, text or not an object', () => {
    for (const body of [undefined, '', '<html>Bad gateway</html>', null, ['x']]) {
      const error = ApiError.fromResponse(502, body);
      expect(error.kind).toBe('unexpected');
      expect(error.message).toBe('Request failed (HTTP 502).');
    }
  });

  it('falls back to the problem detail and then to the status when there is no title', () => {
    expect(ApiError.fromResponse(409, { detail: 'Conflict detail' }).message).toBe(
      'Conflict detail',
    );
    expect(ApiError.fromResponse(409, {}).message).toBe('Request failed (HTTP 409).');
  });
});

describe('error helpers', () => {
  it('classifies retryable and unauthorised errors', () => {
    expect(isRetryable(ApiError.network(new TypeError('Failed to fetch')))).toBe(true);
    expect(isRetryable(ApiError.fromResponse(503, { title: 'Down' }))).toBe(true);
    expect(isRetryable(ApiError.fromResponse(404, { title: 'Missing' }))).toBe(false);
    expect(isRetryable(ApiError.fromResponse(429, { title: 'Slow down' }))).toBe(false);
    expect(isRetryable(new Error('plain'))).toBe(false);
    expect(isUnauthorized(ApiError.fromResponse(401, undefined))).toBe(true);
    expect(isUnauthorized(ApiError.fromResponse(403, undefined))).toBe(false);
  });

  it('describes errors for the person using the app', () => {
    expect(describeError(ApiError.network(new TypeError('x')))).toBe(
      "Can't reach the server. Check your connection and try again.",
    );
    expect(describeError(ApiError.fromResponse(401, undefined))).toBe(
      'Your session has expired. Sign in again.',
    );
    expect(describeError(ApiError.fromResponse(403, undefined))).toBe(
      "You don't have access to this.",
    );
    expect(describeError(ApiError.fromResponse(500, { title: 'secret stack trace' }))).toBe(
      'The server had a problem. Try again in a moment.',
    );
    expect(
      describeError(
        ApiError.fromResponse(429, {
          title: 'eToro was synchronized recently',
          code: 'sync.cooldown',
        }),
      ),
    ).toBe('eToro was synchronized recently.');
    expect(
      describeError(
        ApiError.fromResponse(400, {
          title: 'Invalid',
          errors: { Email: ['Enter a valid email.'] },
        }),
      ),
    ).toBe('Enter a valid email.');
    expect(describeError(new Error('boom'))).toBe('Something went wrong. Try again.');
    expect(describeError(ApiError.fromResponse(418, undefined))).toBe('Request failed (HTTP 418).');
  });
});
