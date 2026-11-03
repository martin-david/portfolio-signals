export const PROBLEM_TYPES: Record<number, string> = {
  400: 'https://tools.ietf.org/html/rfc9110#section-15.5.1',
  404: 'https://tools.ietf.org/html/rfc9110#section-15.5.5',
  409: 'https://tools.ietf.org/html/rfc9110#section-15.5.10',
  429: 'https://tools.ietf.org/html/rfc6585#section-4',
};

export function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

/** An RFC 9457 problem response with the backend's `code` extension. */
export function problem(status: number, title: string, code?: string): Response {
  return new Response(
    JSON.stringify({ type: PROBLEM_TYPES[status], title, status, ...(code ? { code } : {}) }),
    { status, headers: { 'content-type': 'application/problem+json; charset=utf-8' } },
  );
}

/** A 400 with the validation errors keyed by PascalCase property name, as FluentValidation reports them. */
export function validationProblem(errors: Record<string, string[]>): Response {
  return new Response(
    JSON.stringify({
      type: PROBLEM_TYPES[400],
      title: 'One or more validation errors occurred.',
      status: 400,
      errors,
    }),
    { status: 400, headers: { 'content-type': 'application/problem+json; charset=utf-8' } },
  );
}

export function empty(status: number): Response {
  return new Response(null, { status });
}

export function unauthorized(): Response {
  return new Response(null, { status: 401, headers: { 'www-authenticate': 'Bearer' } });
}

export function pause(ms: number): Promise<void> {
  return ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve();
}
