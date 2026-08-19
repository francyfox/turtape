import { TurtapeError } from "@/modules/core/errors";
import { type RetryOptions, withRetry } from "@/modules/http-client/retry";

export interface HttpClientOptions {
  host: string;
  /** Static headers applied to every request (e.g. auth). */
  headers?: Record<string, string>;
  retry?: RetryOptions;
}

export interface HttpRequestOptions {
  path: string;
  method?: string;
  body?: RequestInit["body"];
  headers?: Record<string, string>;
  /** Query params; `undefined` values are omitted, not sent as `"undefined"`. */
  params?: Record<string, string | undefined>;
}

/**
 * Generic fetch + retry + JSON-parsing plumbing, shared by any HTTP-based
 * provider. Protocol-specific concerns (request body shape, response shape,
 * what counts as an application-level error) do NOT belong here -- they're
 * genuinely different per database (TuringDB sends raw Cypher text and gets
 * column-chunked JSON back; a hypothetical Neo4j provider would send/receive
 * JSON in a completely different shape). Only the transport-level plumbing
 * generalizes; create one of these per provider, don't share an instance.
 */
export const createHttpClient = (options: HttpClientOptions) => {
  const retryOptions = options.retry ?? {};

  const send = async <T>(request: HttpRequestOptions): Promise<T> => {
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

    let body: T;
    try {
      body = (await response.json()) as T;
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

  return {
    request: <T>(request: HttpRequestOptions) =>
      withRetry(() => send<T>(request), retryOptions),
  };
};

export type HttpClient = ReturnType<typeof createHttpClient>;
