import type { HttpRequestOptions, Plugin } from "@/modules/plugin/index.ts";

export interface RetryOptions {
  retries?: number;
  minDelayMs?: number;
  maxDelayMs?: number;
  isRetryable?: (error: unknown) => boolean;
}

const DEFAULTS = {
  retries: 2,
  minDelayMs: 100,
  maxDelayMs: 2_000,
} satisfies Required<Omit<RetryOptions, "isRetryable">>;

// No implicit "network error" guess here: what's retryable is protocol-specific
// (see turingdb-provider), and fetch()'s own error type for connection failures
// isn't consistent across runtimes -- Bun throws a plain Error, Node/undici
// throws TypeError -- so type-sniffing silently breaks retry on one of them.
// Callers must say what's retryable; the safe default is "nothing."
const neverRetry = () => false;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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
  retries?: number;
  minDelayMs?: number;
  maxDelayMs?: number;
  /** Unlike the underlying `RetryOptions.isRetryable`, also sees the request
   * that failed -- lets a caller exempt specific requests (e.g. non-idempotent
   * writes) from retry based on what's actually being sent, not just the error. */
  isRetryable?: (error: unknown, request: HttpRequestOptions) => boolean;
}

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
