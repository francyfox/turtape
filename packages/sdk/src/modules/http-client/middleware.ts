import { type RetryOptions, withRetry } from "@/modules/http-client/retry";

export interface HttpRequestOptions {
  path: string;
  method?: string;
  body?: RequestInit["body"];
  headers?: Record<string, string>;
  /** Query params; `undefined` values are omitted, not sent as `"undefined"`. */
  params?: Record<string, string | undefined>;
}

/** Terminal handler a middleware chain bottoms out at, or the next middleware up the chain. */
export type NextFn = (request: HttpRequestOptions) => Promise<unknown>;

/**
 * Angular `HttpInterceptor`-style hook, minus the DI: a plain function that
 * can inspect/rewrite the outgoing request, call `next` to continue the
 * chain, and inspect/rewrite (or catch) the result before returning it.
 * `compose()` nests them outer-to-inner around a terminal handler.
 */
export type Middleware = (
  request: HttpRequestOptions,
  next: NextFn,
) => Promise<unknown>;

export const compose = (middlewares: Middleware[], handler: NextFn): NextFn =>
  middlewares.reduceRight<NextFn>(
    (next, middleware) => (request) => middleware(request, next),
    handler,
  );

export interface RetryMiddlewareOptions {
  retries?: number;
  minDelayMs?: number;
  maxDelayMs?: number;
  /** Unlike the underlying `RetryOptions.isRetryable`, also sees the request
   * that failed -- lets a caller exempt specific requests (e.g. non-idempotent
   * writes) from retry based on what's actually being sent, not just the error. */
  isRetryable?: (error: unknown, request: HttpRequestOptions) => boolean;
}

export const retryMiddleware =
  (options: RetryMiddlewareOptions = {}): Middleware =>
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
