import { TurtapeError } from "@/modules/core/errors";
import {
  compose,
  type HttpRequestOptions,
  type Middleware,
} from "@/modules/http-client/middleware";

export interface HttpClientOptions {
  host: string;
  /** Static headers applied to every request (e.g. auth). */
  headers?: Record<string, string>;
}

export type { HttpRequestOptions };

export interface HttpClient {
  /**
   * Attach a middleware -- Elysia-`.use()`-style plugin chaining, no DI (see
   * `@/modules/http-client/middleware`). Middlewares run outer-to-inner in
   * attachment order: the first `.use()` wraps every one after it, so e.g.
   * `.use(retryMiddleware(...)).use(logMiddleware)` re-runs `logMiddleware`
   * on every retried attempt, not just the first. Returns the same client
   * so calls chain.
   */
  use(middleware: Middleware): HttpClient;
  request<T>(request: HttpRequestOptions): Promise<T>;
}

/**
 * Generic fetch + JSON-parsing plumbing, shared by any HTTP-based provider.
 * Everything else -- retries, auth refresh, logging, and protocol-specific
 * concerns like request body shape or what counts as an application-level
 * error -- is attached with `.use()`, not built in here. Only the raw
 * transport generalizes; create one of these per provider, don't share an
 * instance.
 */
export const createHttpClient = (options: HttpClientOptions): HttpClient => {
  const send = async (request: HttpRequestOptions): Promise<unknown> => {
    const url = new URL(request.path, options.host);
    if (request.params) {
      for (const [key, value] of Object.entries(request.params)) {
        if (value !== undefined) url.searchParams.set(key, value);
      }
    }

    const response = await fetch(url, {
      method: request.method ?? "POST",
      headers: { ...options.headers, ...request.headers },
      body: request.body,
    });

    let body: unknown;
    try {
      body = await response.json();
    } catch (cause) {
      throw new TurtapeError(`Malformed response (HTTP ${response.status})`, {
        cause,
      });
    }

    if (!response.ok) {
      throw new TurtapeError(`Request failed with HTTP ${response.status}`);
    }

    return body;
  };

  const middlewares: Middleware[] = [];

  const client: HttpClient = {
    use(middleware) {
      middlewares.push(middleware);
      return client;
    },
    request: <T>(request: HttpRequestOptions) =>
      compose(middlewares, send)(request) as Promise<T>,
  };

  return client;
};
