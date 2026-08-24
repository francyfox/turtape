import type { HttpRequestOptions, Plugin } from "@/modules/plugin/index.ts";

export interface RetryOptions {
  /** Retry attempts after the first try. Default: 2. */
  retries?: number;
  /** Initial backoff delay in ms, doubling each retry. Default: 100. */
  minDelayMs?: number;
  /** Backoff cap in ms. Default: 2000. */
  maxDelayMs?: number;
  /** Whether a given error should be retried. Default: **never** (nothing is retried). */
  isRetryable?: (error: unknown) => boolean;
}

const DEFAULTS = {
  retries: 2,
  minDelayMs: 100,
  maxDelayMs: 2_000,
} satisfies Required<Omit<RetryOptions, "isRetryable">>;

// Retryability is protocol-specific, and fetch()'s connection-failure error type differs by
// runtime (Bun: plain Error, Node/undici: TypeError) -- callers must say what's retryable.
const neverRetry = () => false;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Retries `fn` with **exponential backoff** (plus jitter) until it succeeds, `isRetryable` says
 * no, or `retries` is exhausted.
 *
 * @example
 * ```ts
 * const result = await withRetry(() => fetch(url), { retries: 3, isRetryable: () => true });
 * ```
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const retries = options.retries ?? DEFAULTS.retries;
  const minDelayMs = options.minDelayMs ?? DEFAULTS.minDelayMs;
  const maxDelayMs = options.maxDelayMs ?? DEFAULTS.maxDelayMs;
  const isRetryable = options.isRetryable ?? neverRetry;

  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt >= retries || !isRetryable(error)) {
        throw error;
      }
      const backoff = Math.min(maxDelayMs, minDelayMs * 2 ** attempt);
      await sleep(backoff + Math.random() * backoff * 0.2);
    }
  }
}

export interface RetryPluginOptions {
  /** Retry attempts after the first try. Default: 2. */
  retries?: number;
  /** Initial backoff delay in ms, doubling each retry. Default: 100. */
  minDelayMs?: number;
  /** Backoff cap in ms. Default: 2000. */
  maxDelayMs?: number;
  /** Unlike `RetryOptions.isRetryable`, also sees the request that failed — lets a caller exempt
   * specific requests (e.g. non-idempotent writes) from retry. Default: **never retry**. */
  isRetryable?: (error: unknown, request: HttpRequestOptions) => boolean;
}

/**
 * A `Plugin` that retries a failed request with backoff.
 *
 * @example
 * ```ts
 * client.use(retryPlugin({ retries: 3, isRetryable: () => true }));
 * ```
 */
export const retryPlugin =
  (options: RetryPluginOptions = {}): Plugin =>
  (request, next) => {
    const retryOptions: RetryOptions = {
      retries: options.retries,
      minDelayMs: options.minDelayMs,
      maxDelayMs: options.maxDelayMs,
      isRetryable: options.isRetryable
        ? (error: unknown) => options.isRetryable?.(error, request) ?? false
        : undefined,
    };
    return withRetry(() => next(request), retryOptions);
  };
