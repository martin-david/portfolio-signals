/**
 * Codes the backend adds to its RFC 9457 problem responses (`code` extension), see the Application handlers.
 * They are part of the contract but not of the OpenAPI document, so they are listed here.
 */
export const ProblemCode = {
  UserNotRegistered: 'user.not_registered',
  PortfolioNotSynced: 'portfolio.not_synced',
  HoldingNotFound: 'holding.not_found',
  IntegrationNotConnected: 'integration.not_connected',
  ManualSyncNotAllowed: 'sync.manual_not_allowed',
  NoActiveConnection: 'sync.no_active_connection',
  SyncCooldown: 'sync.cooldown',
} as const;

export type ProblemCodeValue = (typeof ProblemCode)[keyof typeof ProblemCode];

export type ApiErrorKind = 'problem' | 'network' | 'unexpected';

export interface ApiErrorInit {
  kind: ApiErrorKind;
  status: number;
  title: string;
  code?: string;
  detail?: string;
  fieldErrors?: Record<string, string[]>;
  cause?: unknown;
}

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  /** HTTP status, or 0 when no response arrived. */
  readonly status: number;
  readonly code: string | undefined;
  readonly detail: string | undefined;
  /** Validation messages by property, with property names in camelCase ("DisplayName" becomes "displayName"). */
  readonly fieldErrors: Readonly<Record<string, readonly string[]>>;
  readonly originalError: unknown;

  constructor(init: ApiErrorInit) {
    super(init.title);
    this.name = 'ApiError';
    this.kind = init.kind;
    this.status = init.status;
    this.code = init.code;
    this.detail = init.detail;
    this.fieldErrors = init.fieldErrors ?? {};
    this.originalError = init.cause;
  }

  static network(cause: unknown): ApiError {
    return new ApiError({
      kind: 'network',
      status: 0,
      title: "Can't reach the server.",
      cause,
    });
  }

  /** Builds an error from a non-success response and whatever the body parsed to (an object, text or nothing). */
  static fromResponse(status: number, body: unknown): ApiError {
    if (isRecord(body)) {
      const title =
        asString(body.title) ?? asString(body.detail) ?? `Request failed (HTTP ${status}).`;
      return new ApiError({
        kind: 'problem',
        status,
        title,
        code: asString(body.code),
        detail: asString(body.detail),
        fieldErrors: parseFieldErrors(body.errors),
      });
    }
    return new ApiError({
      kind: 'unexpected',
      status,
      title: `Request failed (HTTP ${status}).`,
    });
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value : undefined;
}

function camelCase(name: string): string {
  return name.length === 0 ? name : name.charAt(0).toLowerCase() + name.slice(1);
}

function parseFieldErrors(value: unknown): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  if (!isRecord(value)) {
    return result;
  }
  for (const [name, messages] of Object.entries(value)) {
    if (Array.isArray(messages)) {
      const texts = messages.filter((message): message is string => typeof message === 'string');
      if (texts.length > 0) {
        result[camelCase(name)] = texts;
      }
    }
  }
  return result;
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

export function hasProblemCode(error: unknown, code: ProblemCodeValue): boolean {
  return isApiError(error) && error.code === code;
}

export function isUnauthorized(error: unknown): boolean {
  return isApiError(error) && error.status === 401;
}

/** Network failures and 5xx responses may succeed on a second try; client errors will not. */
export function isRetryable(error: unknown): boolean {
  if (!isApiError(error)) {
    return false;
  }
  return error.kind === 'network' || error.status >= 500;
}

export function firstFieldError(error: unknown, field: string): string | undefined {
  return isApiError(error) ? error.fieldErrors[field]?.[0] : undefined;
}

function sentence(text: string): string {
  const trimmed = text.trim();
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

/** A message that is safe and useful to show to the person using the app. */
export function describeError(error: unknown): string {
  if (!isApiError(error)) {
    return 'Something went wrong. Try again.';
  }
  if (error.kind === 'network') {
    return "Can't reach the server. Check your connection and try again.";
  }
  if (error.status === 401) {
    return 'Your session has expired. Sign in again.';
  }
  if (error.status === 403) {
    return "You don't have access to this.";
  }
  if (error.status >= 500) {
    return 'The server had a problem. Try again in a moment.';
  }
  if (error.kind === 'problem') {
    const [firstField] = Object.values(error.fieldErrors);
    return sentence(firstField?.[0] ?? error.message);
  }
  return sentence(error.message);
}
