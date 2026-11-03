import { ApiError, hasProblemCode, type ProblemCodeValue } from './errors';

/** What openapi-fetch resolves with: the body on success, the error body otherwise. */
interface Settled {
  data?: unknown;
  error?: unknown;
  response: Response;
}

/** The body type of the successful branch of an openapi-fetch result. */
type SuccessBody<R> = R extends { data: infer D; error?: undefined } ? D : never;

async function settle<R extends Settled>(request: Promise<R>): Promise<R> {
  try {
    return await request;
  } catch (cause) {
    // The caller cancelled (a screen was left): not a failure, let it pass through untouched.
    if (cause instanceof Error && cause.name === 'AbortError') {
      throw cause;
    }
    throw ApiError.network(cause);
  }
}

/** Resolves with the body of a successful response and throws an ApiError for everything else. */
export async function unwrap<R extends Settled>(request: Promise<R>): Promise<SuccessBody<R>> {
  const result = await settle(request);
  if (result.error !== undefined || !result.response.ok) {
    throw ApiError.fromResponse(result.response.status, result.error);
  }
  return result.data as SuccessBody<R>;
}

/** For responses without a body (204 No Content). */
export async function unwrapEmpty(request: Promise<Settled>): Promise<void> {
  const result = await settle(request);
  if (result.error !== undefined || !result.response.ok) {
    throw ApiError.fromResponse(result.response.status, result.error);
  }
}

/**
 * An expected absence is data, not a failure: a user who has not registered yet or a portfolio that has not been
 * synchronized yet resolves to null, so screens can show an empty state instead of an error.
 */
export async function nullWhen<T>(
  request: Promise<T>,
  ...codes: ProblemCodeValue[]
): Promise<T | null> {
  try {
    return await request;
  } catch (error) {
    if (codes.some((code) => hasProblemCode(error, code))) {
      return null;
    }
    throw error;
  }
}
