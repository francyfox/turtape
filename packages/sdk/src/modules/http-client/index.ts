import { TurtapeError } from "@/modules/core/errors";
import {
  compose,
  type HttpRequestOptions,
  type Plugin,
} from "@/modules/plugin";

export interface HttpClientOptions {
  /** Base URL every request is resolved against. */
  host: string;
  /** Static headers applied to every request (e.g. auth). */
  headers?: Record<string, string>;
}

export type { HttpRequestOptions };

export interface HttpClient {
  /**
   * Attaches a plugin to the request pipeline. **The first `.use()` wraps every plugin after
   * it**, so order matters — see `@/modules/plugin`. Returns the same client so calls chain.
   *
   * @example
   * ```ts
   * client.use(retryPlugin()).use(logPlugin());
   * ```
   */
  use(plugin: Plugin): HttpClient;
  request<T>(request: HttpRequestOptions): Promise<T>;
}

/**
 * Generic fetch + JSON-parsing transport shared by any HTTP-based provider. Retries, logging,
 * auth refresh, and other protocol-specific concerns are added with `.use()`, not built in here.
 * *Create one per provider* — its plugin chain isn't meant to be shared across instances.
 *
 * @example
 * ```ts
 * const client = createHttpClient({ host: "http://localhost:6666" });
 * const result = await client.request({ path: "/query", body: "LIST GRAPH" });
 * ```
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

  const plugins: Plugin[] = [];

  const client: HttpClient = {
    use(plugin) {
      plugins.push(plugin);
      return client;
    },
    request: <T>(request: HttpRequestOptions) =>
      compose(plugins, send)(request) as Promise<T>,
  };

  return client;
};
