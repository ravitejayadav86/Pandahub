/**
 * useApiError — unified API error parser hook.
 *
 * Every Axios error from PandaHub's backend now has the same envelope:
 *
 *   { "error": { code, message, hint, docs, severity, request_id, fields, ... } }
 *
 * This hook parses that envelope once so no component reimplements the
 * parsing logic. It also maps error codes to user-friendly copy and
 * returns a strongly-typed ParsedError object.
 *
 * Usage:
 *   const { parseError } = useApiError();
 *   try { ... } catch (err) {
 *     const parsed = parseError(err);
 *     toast.error(parsed.message, { hint: parsed.hint, requestId: parsed.requestId });
 *   }
 */

export interface FieldError {
  field: string;
  message: string;
}

export interface ParsedError {
  /** Machine-readable error code from the server (e.g. "REPOSITORY_NAME_TAKEN") */
  code: string;
  /** Human-readable message suitable for display */
  message: string;
  /** Optional actionable hint */
  hint?: string;
  /** Optional docs link */
  docs?: string;
  /** Severity level: debug | info | warning | error | critical */
  severity: 'debug' | 'info' | 'warning' | 'error' | 'critical';
  /** HTTP status code */
  status: number;
  /** X-Request-ID for reporting */
  requestId?: string;
  /** Per-field validation errors */
  fields: FieldError[];
  /** Whether this is a network error (no response from server) */
  isNetworkError: boolean;
  /** Raw error for debugging */
  raw: unknown;
}

/* ─── User-friendly copy by error code ──────────────────────────────────── */

const USER_MESSAGES: Record<string, string> = {
  UNAUTHORIZED:
    'Your session has expired. Please log in again to continue.',
  PERMISSION_DENIED:
    "You don't have permission to do that.",
  NOT_FOUND:
    "The resource you're looking for doesn't exist or has been removed.",
  CONFLICT:
    'This resource already exists or conflicts with an existing one.',
  RATE_LIMITED:
    "You're making too many requests. Please wait a moment before trying again.",
  SERVICE_UNAVAILABLE:
    'A backend service is temporarily unavailable. Please try again in a few seconds.',
  VALIDATION_ERROR:
    'Some fields contain invalid values. Please check and correct them.',
  GIT_ERROR:
    'A git operation failed. Check your branch name and repository state.',
  INTERNAL_SERVER_ERROR:
    'An unexpected error occurred. The team has been notified.',
  NETWORK_ERROR:
    "Can't reach the server. Check your internet connection and try again.",
};

const DEFAULT_HINTS: Record<string, string> = {
  UNAUTHORIZED:       'Log in or refresh your session.',
  PERMISSION_DENIED:  'Contact a repository admin to request access.',
  NOT_FOUND:          'Double-check the URL or go back to the dashboard.',
  RATE_LIMITED:       'Wait a few seconds, then try again.',
  SERVICE_UNAVAILABLE:'We are aware and are working on a fix.',
  INTERNAL_SERVER_ERROR: 'Copy the Request ID and use it when filing a report.',
};

/* ─── Parser ─────────────────────────────────────────────────────────────── */

export function parseApiError(err: unknown): ParsedError {
  // Network / no-response errors
  if (isAxiosError(err) && !err.response) {
    return {
      code:           'NETWORK_ERROR',
      message:        USER_MESSAGES['NETWORK_ERROR'] || "Can't reach the server. Check your internet connection and try again.",
      hint:           'Check your internet connection and try again.',
      severity:       'error',
      status:         0,
      fields:         [],
      isNetworkError: true,
      raw:            err,
    };
  }

  // PandaHub structured error envelope
  if (isAxiosError(err) && err.response) {
    const data = err.response.data as Record<string, unknown>;
    const envelope = (data?.error ?? {}) as Record<string, unknown>;

    const code      = (envelope.code as string)     || `HTTP_${err.response.status}`;
    const rawMsg    = (envelope.message as string)   || '';
    const message   = rawMsg || USER_MESSAGES[code]  || 'An error occurred.';
    const hint      = (envelope.hint as string)      || DEFAULT_HINTS[code];
    const docs      = envelope.docs as string | undefined;
    const severity  = (envelope.severity as ParsedError['severity']) || 'error';
    const requestId = typeof envelope.request_id === 'string' ? envelope.request_id : undefined;
    const fields    = (envelope.fields as FieldError[]) || [];

    return {
      code,
      message,
      hint,
      docs,
      severity,
      status:         err.response.status,
      requestId,
      fields,
      isNetworkError: false,
      raw:            err,
    };
  }

  // Unknown / non-Axios error
  const fallbackMsg = err instanceof Error ? err.message : 'An unexpected error occurred.';
  return {
    code:           'UNKNOWN_ERROR',
    message:        fallbackMsg,
    severity:       'error',
    status:         0,
    fields:         [],
    isNetworkError: false,
    raw:            err,
  };
}

/* ─── Type guard ─────────────────────────────────────────────────────────── */

function isAxiosError(err: unknown): err is {
  response?: { status: number; data: unknown };
  message: string;
} {
  return typeof err === 'object' && err !== null && 'response' in err;
}

/* ─── Hook wrapper ───────────────────────────────────────────────────────── */

/**
 * Hook that returns parseApiError bound to the current context.
 * Also exports the raw parseApiError for use outside React components.
 */
export function useApiError() {
  return { parseError: parseApiError };
}

export default useApiError;
