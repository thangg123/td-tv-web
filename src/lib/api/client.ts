/**
 * HTTP plumbing for phimapi.com.
 *
 * The API answers with `access-control-allow-origin: *`, so the browser talks
 * to it directly and there is no server tier to deploy or pay for. The
 * User-Agent / Referer pair the Android client sends cannot be set from a
 * browser — they are forbidden headers — and are not needed for the JSON API.
 */

export const API_BASE = 'https://phimapi.com';

/** How long a request may hang before it is abandoned as unresponsive. */
const TIMEOUT_MS = 20_000;

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export class NetworkError extends Error {
  constructor(readonly cause: unknown) {
    super('network');
    this.name = 'NetworkError';
  }
}

export class TimeoutError extends Error {
  constructor() {
    super('timeout');
    this.name = 'TimeoutError';
  }
}

/** `null` and `undefined` mean "omit"; everything else is stringified. */
export type QueryParams = Record<string, string | number | null | undefined>;

const buildUrl = (path: string, params?: QueryParams): string => {
  const url = new URL(path.replace(/^\/+/, ''), `${API_BASE}/`);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value === null || value === undefined || value === '') continue;
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
};

/**
 * One request, with its own timeout, chained to whatever abort signal the
 * caller already has — React Query cancels in-flight queries on unmount and
 * that cancellation has to reach the socket, not just the promise.
 */
export async function apiGet<T>(
  path: string,
  params?: QueryParams,
  signal?: AbortSignal,
): Promise<T> {
  const timeout = AbortSignal.timeout(TIMEOUT_MS);
  const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;

  let response: Response;
  try {
    response = await fetch(buildUrl(path, params), {
      signal: combined,
      headers: { Accept: 'application/json' },
      // No credentials are involved anywhere in this app; saying so keeps the
      // request a simple CORS one and skips the preflight round-trip.
      credentials: 'omit',
      mode: 'cors',
    });
  } catch (error) {
    // The caller's own cancellation must propagate untouched: React Query
    // treats an AbortError as "cancelled", not as a failure to retry.
    if (signal?.aborted) throw error;
    if (timeout.aborted) throw new TimeoutError();
    throw new NetworkError(error);
  }

  if (!response.ok) {
    throw new ApiError(response.status, `HTTP ${response.status}`);
  }

  // A Cloudflare error page occasionally arrives with a 200 and an HTML body,
  // which would otherwise surface as an unreadable JSON syntax error.
  try {
    return (await response.json()) as T;
  } catch {
    throw new ApiError(response.status, 'Phản hồi không hợp lệ');
  }
}

/**
 * Turns a throwable into something worth showing a viewer — port of
 * `com.tdtv.data.ErrorMessages`. Raw exception text leaks internals and means
 * nothing to the person reading it.
 */
export function toUserMessage(error: unknown): string {
  if (error instanceof TimeoutError) {
    return 'Máy chủ phản hồi quá chậm. Vui lòng thử lại.';
  }
  if (error instanceof NetworkError) {
    return 'Không có kết nối mạng. Kiểm tra đường truyền rồi thử lại.';
  }
  if (error instanceof ApiError) {
    if (error.status === 404) return 'Nội dung này không còn tồn tại.';
    if (error.status === 429) return 'Bạn thao tác hơi nhanh. Chờ một lát rồi thử lại.';
    if (error.status >= 500 && error.status <= 599) {
      return 'Máy chủ đang bận. Vui lòng thử lại sau.';
    }
    return 'Không tải được dữ liệu. Vui lòng thử lại.';
  }
  if (error instanceof Error && error.message) {
    // Domain errors raised by the repository carry a message meant for humans.
    if (!/^(network|timeout)$/.test(error.message)) return error.message;
  }
  return 'Đã có lỗi xảy ra. Vui lòng thử lại.';
}
