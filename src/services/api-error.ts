/**
 * Typed errors for network requests, so each screen can say what actually
 * went wrong instead of always blaming the connection.
 */

export type ApiErrorKind = 'offline' | 'timeout' | 'not-found' | 'server' | 'bad-response';

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status?: number;

  constructor(kind: ApiErrorKind, message: string, status?: number) {
    super(message);
    this.name = 'ApiError';
    this.kind = kind;
    this.status = status;
  }
}

/** The kind of error that a failed HTTP status maps to. */
export function kindForStatus(status: number): ApiErrorKind {
  return status === 404 ? 'not-found' : 'server';
}

/** Plain-language text for any error, never the raw technical message. */
export function describeError(error: unknown, subject = 'this'): string {
  const kind = error instanceof ApiError ? error.kind : null;
  switch (kind) {
    case 'offline':
      return 'You appear to be offline. Check your connection and try again.';
    case 'timeout':
      return 'The server took too long to answer. Try again in a moment.';
    case 'not-found':
      return `Could not find ${subject}.`;
    case 'server':
      return 'The card service is having trouble right now. Try again in a moment.';
    case 'bad-response':
      return 'The card service sent something unexpected. Try again in a moment.';
    default:
      return 'Something went wrong. Try again.';
  }
}

/** Whether trying again could help (not for a missing item). */
export function isRetryable(error: unknown): boolean {
  return !(error instanceof ApiError && error.kind === 'not-found');
}

/**
 * fetch with a timeout; network failures and timeouts become ApiErrors.
 * HTTP status handling stays with the caller.
 */
export async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs = 10_000,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (e) {
    if (controller.signal.aborted) {
      throw new ApiError('timeout', `Request timed out after ${timeoutMs} ms`);
    }
    throw new ApiError('offline', e instanceof Error ? e.message : 'Network request failed');
  } finally {
    clearTimeout(timer);
  }
}
